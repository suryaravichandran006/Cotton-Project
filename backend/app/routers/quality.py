"""Independent lab-quality endpoints. Inference finishes before image storage or database writes."""

from __future__ import annotations

import csv
import io
import time
from functools import partial

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from backend.app.config import REPO_ROOT, Settings, get_settings
from backend.app.container import base_url_of, get_services
from backend.app.database import get_db
from backend.app.dependencies import rate_limit, require_api_key
from backend.app.errors import APIError
from backend.app.quality_schemas import LabReferences, QualityHistory, QualityResponse, QualityStatus
from backend.app.routers.predict import _read_limited, _run_with_timeout
from backend.app.services.validation import validate_upload
from ml.quality.schema import PROPERTIES

router = APIRouter()


@router.get("/status", response_model=QualityStatus)
def status(request: Request):
    return get_services(request).quality.status()


@router.get("/references", response_model=LabReferences)
def references(request: Request):
    return get_services(request).quality.references()


@router.get("/report")
def report(request: Request):
    import hashlib

    labels = get_services(request).quality.lab_labels()
    path = (REPO_ROOT / labels["report_file"]).resolve()
    if not path.is_relative_to(REPO_ROOT) or not path.is_file():
        raise APIError(404, "report_unavailable", "The original laboratory report is not installed.")
    if hashlib.sha256(path.read_bytes()).hexdigest() != labels["report_sha256"]:
        raise APIError(409, "report_mismatch", "The report file no longer matches the digitized labels.")
    return FileResponse(path, media_type="application/pdf", filename="cotton-lab-T1-T10.pdf")


@router.post("/analyze", response_model=QualityResponse, dependencies=[Depends(rate_limit), Depends(require_api_key)])
async def analyze(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    start = time.perf_counter()
    data = await _read_limited(file, settings.max_upload_bytes)
    validated = validate_upload(data, file.filename, file.content_type, settings)
    service = get_services(request).quality
    result = await _run_with_timeout(partial(service.analyze, validated.image), settings.inference_timeout_s)
    # A timed-out worker cannot save a late result: persistence happens only after a successful await.
    return service.persist(db, data, validated, result, (time.perf_counter() - start) * 1000, base_url_of(request))


@router.get("/analyses", response_model=QualityHistory)
def history(request: Request, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return get_services(request).quality.history(db, page, page_size)


@router.get("/analyses/{analysis_id}", response_model=QualityResponse)
def get_analysis(request: Request, analysis_id: str, db: Session = Depends(get_db)):
    service = get_services(request).quality
    return service.to_response(service.get(db, analysis_id), base_url_of(request))


@router.get("/analyses/{analysis_id}/csv")
def export_csv(request: Request, analysis_id: str, db: Session = Depends(get_db)):
    service = get_services(request).quality
    result = service.to_response(service.get(db, analysis_id), base_url_of(request))
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["property", "report_code", "value", "unit", "status", "observed_single_photo_mae", "model", "version", "note"])
    for prop in result.properties:
        # All exported strings come from the controlled property schema/model artifact, never client filenames.
        writer.writerow([prop.label, prop.code, prop.value, prop.unit, prop.status, prop.observed_mae, result.model.name, result.model.version, prop.note])
    return Response(stream.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="cotton-quality-{result.id}.csv"'})


@router.delete("/analyses/{analysis_id}", dependencies=[Depends(require_api_key)])
def delete_analysis(request: Request, analysis_id: str, db: Session = Depends(get_db)):
    get_services(request).quality.delete(db, analysis_id)
    return {"id": analysis_id, "deleted": True}


@router.get("/analyses/{analysis_id}/reference.csv")
def export_reference_csv(request: Request, analysis_id: str, db: Session = Depends(get_db)):
    service = get_services(request).quality
    result = service.to_response(service.get(db, analysis_id), base_url_of(request))
    if result.status == "withheld" or result.reference is None:
        raise APIError(409, "reference_not_matched", "No usable reference match is available for this photograph.")
    reference = result.reference.report
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["reference_lot", "property", "report_code", "recorded_value", "unit", "reported_stddev", "report_date", "report_page", "value_source"])
    fields = [(p.key, p.label, p.code, p.unit) for p in PROPERTIES]
    fields += [
        ("colour_grade", "Colour grade", "CGrd", None),
        ("trash_grade", "Trash grade", "TrGrd", None),
        ("grade", "Grade", "Grade", None),
        ("amt", "Amt (instrument field)", "Amt", None),
    ]
    for key, label, code, unit in fields:
        writer.writerow(
            [
                reference.lot_id,
                label,
                code,
                reference.grade if key == "grade" else reference.average.get(key),
                unit,
                reference.reported_stddev.get(key),
                reference.report_date,
                reference.report_page,
                "recorded_lab_profile_not_photo_measurement",
            ]
        )
    return Response(
        stream.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="cotton-{reference.lot_id}-lab-profile.csv"'}
    )

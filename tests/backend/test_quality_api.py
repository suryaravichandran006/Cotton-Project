"""Quality API preserves estimates and evidence, validates uploads, and cleans up failed writes."""

from __future__ import annotations

import copy
from pathlib import Path

import pytest
from sqlalchemy.exc import SQLAlchemyError

from backend.app.services.validation import validate_upload
from ml.quality.data import fingerprint, read_labels


def synthetic_result():
    labels = read_labels()
    return {
        "status": "experimental",
        "withheld_reason": None,
        "model": {
            "name": "cnn_lstm",
            "version": "synthetic-contract-test",
            "experimental": True,
            "label_status": "provisional_lot_average",
            "independent_lots": 10,
        },
        "properties": [
            {
                "key": "micronaire",
                "label": "Micronaire",
                "code": "Mic",
                "unit": None,
                "decimals": 2,
                "value": 4.2,
                "status": "experimental_estimate",
                "observed_mae": 0.5,
                "beats_mean_baseline": False,
                "note": "Synthetic fixture; not training evidence.",
            }
        ],
        "capture": {"passed": True, "brightness": 140, "focus_score": 50, "reasons": [], "scope": "Synthetic fixture"},
        "reference": {
            "lot_id": "T1",
            "cosine_distance": 0.1,
            "identity_verified": False,
            "note": "Closest visual reference only.",
            "report": labels["lots"][0],
        },
        "warnings": ["Experimental; not laboratory measurements."],
        "label_fingerprint": fingerprint(labels),
    }


def test_untrained_status_blocks_without_mock_measurements(fresh_client, tmp_path):
    service = fresh_client.app.state.services.quality
    service.settings.quality_model_path = str(tmp_path / "absent.json")
    status = fresh_client.get("/api/v1/quality/status")
    assert status.status_code == 200 and status.json()["status"] == "not_trained"
    assert status.json()["model"] is None
    from tests.conftest import make_image_bytes

    response = fresh_client.post("/api/v1/quality/analyze", files={"file": ("photo.png", make_image_bytes(), "image/png")})
    assert response.status_code == 503
    assert fresh_client.get("/api/v1/quality/analyses").json()["total"] == 0


def test_quality_upload_validation(fresh_client, png_bytes, monkeypatch):
    service = fresh_client.app.state.services.quality
    called = []
    monkeypatch.setattr(service, "analyze", lambda image: called.append(image))
    for data, status in [(b"", 400), (b"not an image", 415), (png_bytes * 100, 413)]:
        response = fresh_client.post("/api/v1/quality/analyze", files={"file": ("cotton.png", data, "image/png")})
        assert response.status_code == status
    assert not called


def test_saved_result_survives_model_change_and_exports_estimates(fresh_client, png_bytes, monkeypatch):
    service = fresh_client.app.state.services.quality
    result = synthetic_result()
    monkeypatch.setattr(service, "analyze", lambda image: copy.deepcopy(result))
    response = fresh_client.post("/api/v1/quality/analyze", files={"file": ("../cotton.png", png_bytes, "image/png")})
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["created_at"].endswith("Z")
    result["properties"][0]["value"] = 99
    result["model"]["version"] = "replacement"
    recovered = fresh_client.get(f"/api/v1/quality/analyses/{saved['id']}").json()
    assert recovered["properties"][0]["value"] == 4.2
    assert recovered["reference"]["report"]["average"]["micronaire"] == 4.74
    assert recovered["model"]["version"] == "synthetic-contract-test"
    assert recovered["image"]["original_filename"] == "cotton.png"
    assert fresh_client.get("/api/v1/quality/analyses").json()["total"] == 1
    export = fresh_client.get(f"/api/v1/quality/analyses/{saved['id']}/csv")
    assert export.status_code == 200 and "experimental_estimate" in export.text and "4.2" in export.text
    lab_export = fresh_client.get(f"/api/v1/quality/analyses/{saved['id']}/reference.csv")
    import csv
    import io

    assert lab_export.status_code == 200
    rows = list(csv.DictReader(io.StringIO(lab_export.text)))
    assert len(rows) == 17
    micronaire = next(row for row in rows if row["report_code"] == "Mic")
    assert micronaire["recorded_value"] == "4.74" and micronaire["reported_stddev"] == "0.11"
    assert micronaire["reference_lot"] == "T1"
    assert micronaire["value_source"] == "recorded_lab_profile_not_photo_measurement"
    assert "cotton-T1-lab-profile.csv" in lab_export.headers["content-disposition"]
    assert fresh_client.delete(f"/api/v1/quality/analyses/{saved['id']}").status_code == 200
    assert fresh_client.get(f"/api/v1/quality/analyses/{saved['id']}").status_code == 404
    assert not list(service.settings.upload_path.glob("*"))


def test_withheld_photo_has_no_reference_csv(fresh_client, png_bytes, monkeypatch):
    service = fresh_client.app.state.services.quality
    result = synthetic_result()
    result["status"] = "withheld"
    monkeypatch.setattr(service, "analyze", lambda image: copy.deepcopy(result))
    saved = fresh_client.post("/api/v1/quality/analyze", files={"file": ("photo.png", png_bytes, "image/png")}).json()
    export = fresh_client.get(f"/api/v1/quality/analyses/{saved['id']}/reference.csv")
    assert export.status_code == 409


def test_database_failure_removes_upload(fresh_client, png_bytes, monkeypatch):
    service = fresh_client.app.state.services.quality
    from backend.app.database import get_sessionmaker

    validated = validate_upload(png_bytes, "photo.png", "image/png", service.settings)
    with get_sessionmaker()() as session:

        def fail():
            raise SQLAlchemyError("simulated failure")

        monkeypatch.setattr(session, "commit", fail)
        with pytest.raises(Exception) as error:
            service.persist(session, png_bytes, validated, synthetic_result(), 100, "http://test")
        assert error.value.code == "database_error"
    assert not list(service.settings.upload_path.glob("*"))


def test_references_and_original_pdf(fresh_client):
    response = fresh_client.get("/api/v1/quality/references")
    assert response.status_code == 200 and len(response.json()["lots"]) == 10
    assert response.json()["label_status"] == "provisional_lot_average"
    report = fresh_client.get("/api/v1/quality/report")
    if Path(read_labels()["report_file"]).is_file():
        assert report.status_code == 200 and report.content.startswith(b"%PDF")
    else:
        assert report.status_code == 404


def test_timeout_cannot_persist_a_late_result(fresh_client, png_bytes, monkeypatch):
    import time

    service = fresh_client.app.state.services.quality
    service.settings.inference_timeout_s = 0.001

    def slow_analysis(image):
        time.sleep(0.05)
        return synthetic_result()

    monkeypatch.setattr(service, "analyze", slow_analysis)
    response = fresh_client.post("/api/v1/quality/analyze", files={"file": ("cotton.png", png_bytes, "image/png")})
    assert response.status_code == 504
    time.sleep(0.06)
    assert fresh_client.get("/api/v1/quality/analyses").json()["total"] == 0
    assert not list(service.settings.upload_path.glob("*"))


def test_analysis_and_deletion_respect_api_key(fresh_client, png_bytes, monkeypatch):
    service = fresh_client.app.state.services.quality
    service.settings.api_key = "synthetic-test-key"
    monkeypatch.setattr(service, "analyze", lambda image: synthetic_result())
    files = {"file": ("cotton.png", png_bytes, "image/png")}
    assert fresh_client.post("/api/v1/quality/analyze", files=files).status_code == 401
    response = fresh_client.post("/api/v1/quality/analyze", files=files, headers={"X-API-Key": "synthetic-test-key"})
    assert response.status_code == 200
    analysis_id = response.json()["id"]
    assert fresh_client.delete(f"/api/v1/quality/analyses/{analysis_id}").status_code == 401
    assert fresh_client.delete(f"/api/v1/quality/analyses/{analysis_id}", headers={"X-API-Key": "synthetic-test-key"}).status_code == 200

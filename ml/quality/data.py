"""Read report labels and build a traceable manifest without changing original photographs."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from ml.quality.schema import CATEGORY_KEYS, NUMERIC_KEYS, PROPERTIES
from ml.utils.paths import REPO_ROOT

DEFAULT_LABELS = REPO_ROOT / "data/metadata/lab_quality.json"
DEFAULT_VIEWS = REPO_ROOT / "data/metadata/lab_image_views.json"


def read_labels(path: str | Path = DEFAULT_LABELS) -> dict:
    data = json.loads(Path(path).read_text())
    if data.get("schema_version") != 1 or not data.get("lots"):
        raise ValueError("Unsupported or empty lab-label schema")
    ids = [lot["lot_id"] for lot in data["lots"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate lot IDs")
    for lot in data["lots"]:
        values = lot["average"]
        for prop in PROPERTIES:
            value = values[prop.key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not np.isfinite(value):
                raise ValueError(f"Invalid {lot['lot_id']} / {prop.key}")
            if value < prop.minimum or (prop.maximum is not None and value > prop.maximum):
                raise ValueError(f"Out-of-range {lot['lot_id']} / {prop.key}")
        for key in CATEGORY_KEYS:
            if not isinstance(values[key], str) or not values[key]:
                raise ValueError(f"Missing categorical code: {key}")
    return data


def fingerprint(labels: dict) -> str:
    return hashlib.sha256(json.dumps(labels, sort_keys=True).encode()).hexdigest()


def build_manifest(image_root: str | Path, labels: dict, views_path: str | Path | None = DEFAULT_VIEWS) -> dict:
    root = Path(image_root).resolve()
    lot_map = {lot["lot_id"]: lot for lot in labels["lots"]}
    prepared = set(json.loads(Path(views_path).read_text())["prepared_fibre_images"]) if views_path and Path(views_path).is_file() else set()
    records, excluded = [], []
    seen = {}
    for folder in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")):
        match = re.search(r"\bT(\d+)\s*$", folder.name, flags=re.I)
        if not match or f"T{int(match[1])}" not in lot_map:
            raise ValueError(f"No report mapping for folder: {folder.name}")
        lot_id = f"T{int(match[1])}"
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            if path.suffix.lower() not in {".jpeg", ".jpg", ".png", ".webp"}:
                excluded.append({"path": str(path), "reason": "unsupported_format"})
                continue
            try:
                with Image.open(path) as im:
                    im.verify()
                with Image.open(path) as im:
                    im.load()  # verify() alone misses some truncated JPEGs
                    w, h = ImageOps.exif_transpose(im).size
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                if digest in seen:
                    if seen[digest]["lot_id"] != lot_id:
                        raise ValueError("Identical image has conflicting lot labels")
                    excluded.append({"path": str(path), "reason": "exact_duplicate", "original": seen[digest]["image_path"]})
                    continue
                record = {
                    "image_path": str(path),
                    "lot_id": lot_id,
                    "sample_id": None,
                    "capture_session": None,
                    "sha256": digest,
                    "width": w,
                    "height": h,
                    "label_scope": "provisional_lot_average",
                    "report_page": lot_map[lot_id]["report_page"],
                }
                record["view_type"] = "prepared_fibre" if path.relative_to(root).as_posix() in prepared else "loose_fibre"
                record["training_eligible"] = record["view_type"] == "loose_fibre"
                records.append(record)
                seen[digest] = record
            except (OSError, ValueError, SyntaxError) as exc:
                if "conflicting lot" in str(exc):
                    raise
                excluded.append({"path": str(path), "reason": f"unreadable: {exc}"})
    counts = Counter(r["lot_id"] for r in records)
    missing = set(lot_map) - set(counts)
    if missing:
        raise ValueError(f"No usable images for lots: {sorted(missing)}")
    return {
        "schema_version": 1,
        "label_fingerprint": fingerprint(labels),
        "label_status": labels["label_status"],
        "independent_label_groups": len(counts),
        "usable_images": len(records),
        "images_per_lot": dict(counts),
        "records": records,
        "excluded": excluded,
        "limitations": labels["limitations"],
    }


def targets_for(records: list[dict], labels: dict) -> np.ndarray:
    values = {lot["lot_id"]: lot["average"] for lot in labels["lots"]}
    return np.asarray([[values[r["lot_id"]][k] for k in NUMERIC_KEYS] for r in records], dtype=np.float32)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", default=str(REPO_ROOT / "Lab Reports"))
    parser.add_argument("--labels", default=str(DEFAULT_LABELS))
    parser.add_argument("--output", default=str(REPO_ROOT / "data/processed/quality/manifest.json"))
    args = parser.parse_args()
    report = build_manifest(args.images, read_labels(args.labels))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ["usable_images", "independent_label_groups", "images_per_lot", "excluded"]}, indent=2))


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from ml.audit_dataset import audit
from ml.data.discovery import discover_dataset, discover_from_csv
from ml.data.preprocessing import InvalidImageError, PreprocessConfig, load_image, preprocess_image
from ml.data.splits import create_splits, load_splits, save_splits


def test_directory_discovery(tiny_dataset: Path):
    index = discover_dataset(tiny_dataset)
    assert index.class_names == ["Variety_A", "Variety_B", "Variety_C"]
    assert index.num_classes == 3 and len(index) == 19  # 18 + 1 duplicate
    assert index.counts_per_class()["Variety_A"] == 7
    assert any(f.endswith("notes.txt") for f in index.invalid_files)
    assert index.available_group_keys() == []


def test_csv_discovery_and_grouped_split(tiny_dataset: Path, tmp_path: Path):
    index = discover_dataset(tiny_dataset)
    csv_path = tmp_path / "meta.csv"
    with open(csv_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["image_path", "class_name", "sample_id", "batch_id", "source", "capture_device"])
        w.writeheader()
        for i, r in enumerate(index.records):
            w.writerow(
                {
                    "image_path": r.image_path,
                    "class_name": r.class_name,
                    "sample_id": f"{r.class_name}_s{i % 3}",
                    "batch_id": "b1",
                    "source": "lab",
                    "capture_device": "phone",
                }
            )
    csv_index = discover_from_csv(csv_path)
    assert csv_index.available_group_keys() == ["sample_id", "batch_id", "source"]

    result = create_splits(csv_index, (0.6, 0.2, 0.2), seed=1, group_by="auto")
    assert result.group_key == "sample_id" and result.check_no_group_leakage()
    assert len(result.train) + len(result.val) + len(result.test) == len(csv_index)

    out = save_splits(result, tmp_path / "splits")
    reloaded = load_splits(out)
    assert reloaded.class_names == csv_index.class_names and len(reloaded.train) == len(result.train)


def test_stratified_split_is_deterministic(tiny_dataset: Path):
    index = discover_dataset(tiny_dataset)
    a = create_splits(index, (0.7, 0.15, 0.15), seed=42)
    b = create_splits(index, (0.7, 0.15, 0.15), seed=42)
    assert [r.image_path for r in a.test] == [r.image_path for r in b.test]
    assert a.group_key is None and set(r.class_name for r in a.train) == set(index.class_names)
    with pytest.raises(ValueError):
        create_splits(index, (0.5, 0.3, 0.3))


def test_preprocessing_shape_and_normalisation():
    img = Image.fromarray((np.random.default_rng(0).random((300, 500, 3)) * 255).astype("uint8"))
    chw, view = preprocess_image(img, PreprocessConfig(image_size=224))
    assert chw.shape == (3, 224, 224) and chw.dtype == np.float32 and view.size == (224, 224)
    assert -3 < chw.mean() < 3

    gray = Image.new("L", (100, 100), 128)
    chw2, _ = preprocess_image(gray, PreprocessConfig(image_size=64))
    assert chw2.shape == (3, 64, 64)


def test_load_image_rejects_garbage_and_handles_rgba():
    with pytest.raises(InvalidImageError):
        load_image(b"definitely not an image")
    buf = io.BytesIO()
    Image.new("RGBA", (40, 40), (255, 0, 0, 128)).save(buf, format="PNG")
    assert load_image(buf.getvalue()).mode == "RGB"


def test_audit_detects_duplicates_and_invalid_files(tiny_dataset: Path):
    report = audit(discover_dataset(tiny_dataset))
    assert report["num_classes"] == 3 and report["total_images"] == 19
    assert len(report["exact_duplicates"]) == 1 and report["corrupt_images"] == []
    assert report["invalid_extension_files"] and report["image_dimensions"]["width"]["min"] == 128
    assert any("< 50 images" in w for w in report["warnings"])

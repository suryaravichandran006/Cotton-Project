from __future__ import annotations

import csv
import json
from pathlib import Path

import torch

from ml.audit_dataset import audit, export_csv_summary, export_markdown_report, run_audit
from ml.benchmark import run_dry_run
from ml.config import load_train_config
from ml.data.discovery import discover_dataset
from ml.data.splits import create_splits
from ml.data.transforms import build_train_transform
from ml.models.factory import get_model
from ml.validate_artifact import validate_artifact


def test_audit_report_exports(tiny_dataset: Path, tmp_path: Path):
    """Test that audit generates valid JSON, Markdown, and CSV reports."""
    index = discover_dataset(tiny_dataset)
    report = audit(index)

    out_dir = tmp_path / "audit_reports"
    md_file = export_markdown_report(report, out_dir / "audit_report.md")
    csv_file = export_csv_summary(report, out_dir / "classes_summary.csv")

    assert md_file.is_file()
    assert csv_file.is_file()

    md_content = md_file.read_text(encoding="utf-8")
    assert "# Cotton Grade: Dataset Structural Audit Report" in md_content
    assert "Variety_A" in md_content
    assert "Specimen-Level Leakage Prevention" in md_content

    csv_content = csv_file.read_text(encoding="utf-8")
    assert "class_name,image_count,percent_of_dataset" in csv_content
    assert "Variety_A" in csv_content


def test_audit_cli_execution(tiny_dataset: Path, tmp_path: Path):
    """Test run_audit full workflow with file output."""
    out_dir = tmp_path / "cli_audit_out"
    report = run_audit(data_dir=tiny_dataset, output_dir=out_dir)
    assert report["num_classes"] == 3
    assert (out_dir / "audit_report.json").is_file()
    assert (out_dir / "audit_report.md").is_file()
    assert (out_dir / "classes_summary.csv").is_file()


def test_benchmark_dry_run_candidate_architectures():
    """Test that all 4 candidate architectures pass the benchmark dry-run."""
    results = run_dry_run(num_classes=4, image_size=224, device_name="cpu")
    assert len(results) == 4
    arch_names = {r.architecture for r in results}
    assert arch_names == {"resnet50", "efficientnetv2_s", "convnext_tiny", "mobilenetv3_large"}

    for result in results:
        assert result.forward_pass_ok is True, f"Forward pass failed for {result.architecture}"
        assert result.gradcam_hook_ok is True, f"GradCAM hook failed for {result.architecture}"
        assert result.parameters > 1_000_000


def test_split_specimen_leakage_warning_and_summary(tiny_dataset: Path, caplog):
    """Test that folder-only splits issue academic leakage warning and report metadata."""
    import logging

    caplog.set_level(logging.WARNING)
    index = discover_dataset(tiny_dataset)
    splits = create_splits(index, (0.7, 0.15, 0.15), seed=42)

    assert splits.group_key is None
    summary = splits.summary()
    assert summary["specimen_leakage_risk"] == "HIGH - FOLDER ONLY DATASET"
    assert "sample_id" in summary["guidance"]
    assert any("FOLDER-ONLY SPLIT WARNING" in rec.message for rec in caplog.records)


def test_lighting_augmentation_config_and_pipeline():
    """Test that lighting augmentations are disabled by default and enabled conditionally."""
    cfg = load_train_config("config/train.yaml")
    assert cfg.enable_lighting_aug is False

    preset = {
        "random_crop_scale": [0.8, 1.0],
        "horizontal_flip": 0.5,
        "color_p": 0.5,
        "hsv_p": 0.5,
        "shadow_p": 0.3,
    }

    t_off = build_train_transform(224, preset, enable_lighting_aug=False)
    step_names_off = [s.__class__.__name__ for s in t_off.transforms]
    assert "RandomBrightnessContrast" not in step_names_off
    assert "HueSaturationValue" not in step_names_off
    assert "RandomShadow" not in step_names_off

    t_on = build_train_transform(224, preset, enable_lighting_aug=True)
    step_names_on = [s.__class__.__name__ for s in t_on.transforms]
    assert "RandomBrightnessContrast" in step_names_on
    assert "HueSaturationValue" in step_names_on
    assert "RandomShadow" in step_names_on


def test_validate_artifact_with_synthetic_checkpoint(tmp_path: Path):
    """Test validate_artifact on a valid export artifact."""
    art_dir = tmp_path / "convnext_tiny_test"
    art_dir.mkdir()

    class_names = ["Gossypium_hirsutum", "Gossypium_barbadense"]
    model = get_model("convnext_tiny", num_classes=len(class_names), pretrained=False)
    ckpt_path = art_dir / "model.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "architecture": "convnext_tiny",
            "class_names": class_names,
            "image_size": 224,
            "calibration_temperature": 1.05,
            "dropout": 0.2,
        },
        ckpt_path,
    )

    meta = {
        "name": "convnext_tiny_test",
        "version": "1.0.0",
        "architecture": "convnext_tiny",
        "class_names": class_names,
        "image_size": 224,
        "calibration_temperature": 1.05,
    }
    (art_dir / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")

    report = validate_artifact(artifact_dir=art_dir, device="cpu")
    assert report.is_valid is True
    assert len(report.errors) == 0
    assert report.details["parameters_m"] > 20
    assert report.details["gradcam_layer"] == "stages.3"


def test_validate_artifact_rejects_corrupted_model(tmp_path: Path):
    """Test validate_artifact rejects corrupted or incomplete artifacts."""
    art_dir = tmp_path / "broken_art"
    art_dir.mkdir()

    report = validate_artifact(artifact_dir=art_dir)
    assert report.is_valid is False
    assert any("metadata.json missing" in err for err in report.errors)

    (art_dir / "metadata.json").write_text(json.dumps({"name": "broken"}), encoding="utf-8")
    (art_dir / "model.pt").write_bytes(b"garbage not a torch checkpoint")
    report2 = validate_artifact(artifact_dir=art_dir)
    assert report2.is_valid is False
    assert any("Failed loading checkpoint" in err for err in report2.errors)


def test_activate_model_workflow(tmp_path: Path):
    """Test activating a model using ml.activate_model with pre-activation validation."""
    from ml.activate_model import activate_model
    from ml.registry import ModelEntry, ModelRegistry

    reg_file = tmp_path / "registry.json"
    registry = ModelRegistry(reg_file)

    art_dir = tmp_path / "model_export"
    art_dir.mkdir()
    class_names = ["Giza_86", "Giza_94"]
    model = get_model("resnet50", num_classes=len(class_names), pretrained=False)
    ckpt_path = art_dir / "model.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "architecture": "resnet50",
            "class_names": class_names,
            "image_size": 224,
            "calibration_temperature": 1.0,
        },
        ckpt_path,
    )
    meta = {
        "name": "cotton-resnet50",
        "version": "1.0.0",
        "architecture": "resnet50",
        "class_names": class_names,
        "image_size": 224,
        "checkpoint": str(ckpt_path),
    }
    (art_dir / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")

    entry = ModelEntry.from_dict(meta)
    registry.add(entry)
    registry.save()

    rc = activate_model("cotton-resnet50", registry_path=reg_file, validate=True, device="cpu")
    assert rc == 0
    reloaded_reg = ModelRegistry(reg_file)
    assert reloaded_reg.active_model == "cotton-resnet50"

    rc_missing = activate_model("non_existent_net", registry_path=reg_file, validate=True)
    assert rc_missing == 1


def test_strict_specimen_leakage_runtime_error(tiny_dataset: Path, tmp_path: Path):
    """Test that create_splits strictly raises RuntimeError if specimen leakage occurs."""
    from ml.data.discovery import discover_from_csv
    from ml.data.splits import create_splits as grouped_create_splits

    csv_path = tmp_path / "leakage_meta.csv"
    with open(csv_path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["image_path", "class_name", "sample_id"])
        writer.writeheader()
        for i in range(10):
            img_file = tiny_dataset / "Variety_A" / f"img_{i:02d}.jpg"
            img_file.touch()
            writer.writerow({"image_path": str(img_file), "class_name": "Variety_A", "sample_id": f"sample_{i}"})
        for i in range(10):
            img_file = tiny_dataset / "Variety_B" / f"img_{i:02d}.jpg"
            img_file.touch()
            writer.writerow({"image_path": str(img_file), "class_name": "Variety_B", "sample_id": f"sample_b_{i}"})

    index = discover_from_csv(csv_path)
    split_res = grouped_create_splits(index, (0.7, 0.15, 0.15), seed=42, group_by="sample_id")
    assert split_res.check_no_group_leakage() is True

    leaked_record = split_res.train[0]
    split_res.test.append(leaked_record)
    assert split_res.check_no_group_leakage() is False

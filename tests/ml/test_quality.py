"""Behavioral tests for leakage prevention, artifact integrity and honest withholding."""

from __future__ import annotations

import json

import numpy as np
import pytest
import torch
from PIL import Image
from torchvision.models import mobilenet_v3_small

from ml.quality.data import build_manifest, fingerprint, read_labels
from ml.quality.matching import evaluate_known_lot_matching
from ml.quality.model import FEATURE_CHANNELS, IMAGE_SIZE, TOKEN_GRID, QualityHead
from ml.quality.predictor import QualityArtifactError, QualityPredictor, capture_checks, sha256
from ml.quality.schema import CATEGORY_KEYS, NUMERIC_KEYS, PROPERTY_VERSION
from ml.quality.train import fit_candidate, group_weights, grouped_folds


@pytest.fixture
def quality_artifact(tmp_path):
    """Synthetic artifact for contract tests only; never scientific training evidence."""
    root = tmp_path / "model"
    root.mkdir()
    labels = read_labels()
    labels["lots"] = labels["lots"][:2]
    (root / "labels.json").write_text(json.dumps(labels))
    model = mobilenet_v3_small(weights=None).features
    torch.save(model.state_dict(), root / "backbone.pt")
    np.savez(
        root / "parameters.npz",
        x_mean=np.zeros(FEATURE_CHANNELS, dtype=np.float32),
        x_scale=np.ones(FEATURE_CHANNELS, dtype=np.float32),
        y_mean=np.asarray([labels["lots"][0]["average"][k] for k in NUMERIC_KEYS], dtype=np.float32),
        y_scale=np.ones(len(NUMERIC_KEYS), dtype=np.float32),
        category_defaults=np.zeros(2, dtype=int),
    )
    np.savez(root / "references.npz", vectors=np.ones((2, FEATURE_CHANNELS), dtype=np.float32))
    metrics = {
        "model": "mean",
        "selected": True,
        "properties": {key: {"mae": 1.0, "rmse": 1.5, "beats_mean_baseline": False} for key in NUMERIC_KEYS},
        "category_accuracy": {key: 0.1 for key in CATEGORY_KEYS},
    }
    (root / "evaluation.json").write_text(
        json.dumps(
            {
                "comparison": [metrics],
                "independent_lots": 2,
                "training_images": 4,
                "selection_rule": "synthetic test fixture",
                "evaluation_scope": "synthetic",
                "limitations": ["Synthetic fixture; not measured evidence."],
            }
        )
    )
    files = ["backbone.pt", "parameters.npz", "references.npz", "labels.json", "evaluation.json"]
    artifact = {
        "schema_version": 1,
        "property_version": PROPERTY_VERSION,
        "numeric_keys": NUMERIC_KEYS,
        "category_keys": CATEGORY_KEYS,
        "model": "mean",
        "model_version": "fixture",
        "feature_channels": FEATURE_CHANNELS,
        "image_size": IMAGE_SIZE,
        "token_grid": TOKEN_GRID,
        "experimental": True,
        "label_fingerprint": fingerprint(labels),
        "label_status": labels["label_status"],
        "category_values": [["21-1"], ["2"]],
        "reference_lots": ["T1", "T2"],
        "distance_threshold": 1.1,
        "files": {name: sha256(root / name) for name in files},
    }
    (root / "artifact.json").write_text(json.dumps(artifact))
    active = tmp_path / "active.json"
    active.write_text(json.dumps({"schema_version": 1, "artifact": "model/artifact.json", "sha256": sha256(root / "artifact.json")}))
    return active


def test_real_labels_retain_all_fields_and_provenance():
    labels = read_labels()
    assert labels["label_status"] == "provisional_lot_average"
    assert len(labels["lots"]) == 10
    assert labels["lots"][0]["average"]["micronaire"] == 4.74
    assert labels["lots"][7]["average"]["trash_area"] == 2.81
    assert all(lot["test_count"] == 4 and lot["grade"] is None for lot in labels["lots"])
    assert all(set(NUMERIC_KEYS + CATEGORY_KEYS + ["amt"]) == set(lot["average"]) for lot in labels["lots"])


def test_manifest_detects_empty_files_and_conflicting_duplicate_labels(tmp_path):
    labels = read_labels()
    labels["lots"] = labels["lots"][:2]
    for name in ["40's T1", "40's T2"]:
        (tmp_path / name).mkdir()
    image = tmp_path / "40's T1/a.jpeg"
    Image.fromarray(np.random.default_rng(1).integers(0, 255, (100, 100, 3), dtype=np.uint8)).save(image)
    (tmp_path / "40's T1/empty.jpeg").touch()
    Image.new("RGB", (100, 100), "gray").save(tmp_path / "40's T2/b.jpeg")
    report = build_manifest(tmp_path, labels, views_path=None)
    assert report["usable_images"] == 2 and len(report["excluded"]) == 1
    assert all(r["sample_id"] is None for r in report["records"])
    (tmp_path / "40's T2/copy.jpeg").write_bytes(image.read_bytes())
    with pytest.raises(ValueError, match="conflicting lot"):
        build_manifest(tmp_path, labels, views_path=None)


def test_every_outer_fold_is_lot_isolated_and_tests_each_lot_once():
    groups = np.repeat([f"T{i}" for i in range(10)], np.arange(1, 11))
    tested = []
    for train, val, test in grouped_folds(groups):
        a, b, c = [set(groups[idx]) for idx in [train, val, test]]
        assert not a & b and not a & c and not b & c
        tested.extend(c)
    assert sorted(tested) == sorted(set(groups))
    weights = group_weights(groups)
    assert np.allclose([weights[groups == group].sum() for group in set(groups)], 0.1)


def test_label_scaling_uses_only_training_lots():
    x = np.zeros((8, 16, 3), dtype=np.float32)
    y = np.repeat(np.arange(8, dtype=np.float32)[:, None], len(NUMERIC_KEYS), axis=1)
    groups = np.asarray(["a", "a", "b", "b", "c", "c", "d", "d"])
    fit = fit_candidate("mean", x, y, np.zeros((8, 2), dtype=int), groups, [1, 1], np.arange(4), np.arange(4, 8))
    assert np.allclose(fit["y_mean"], 1.5)
    y[4:] = 100000
    again = fit_candidate("mean", x, y, np.zeros((8, 2), dtype=int), groups, [1, 1], np.arange(4), np.arange(4, 8))
    assert np.array_equal(fit["y_mean"], again["y_mean"])


def test_matching_evaluation_excludes_query_photos_and_tests_each_once():
    groups = np.repeat(["T1", "T2"], 6)
    vectors = np.repeat(np.eye(2, dtype=np.float32), 6, axis=0)
    tokens = np.repeat(vectors[:, None, :], 16, axis=1)
    report = evaluate_known_lot_matching(tokens, groups)
    tested = []
    for fold in report["folds"]:
        assert not set(fold["reference_indices"]) & set(fold["query_indices"])
        assert set(groups[fold["reference_indices"]]) == {"T1", "T2"}
        tested.extend(fold["query_indices"])
    assert sorted(tested) == list(range(12))
    assert report["accuracy"] == 1.0 and report["correct"] == 12
    assert report["confusion_matrix"] == [[6, 0], [0, 6]]
    assert "not accuracy on new lots" in report["scope"]


def test_identical_features_do_not_invent_perfect_matching():
    groups = np.repeat(["T1", "T2"], 5)
    report = evaluate_known_lot_matching(np.ones((10, 16, 2)), groups)
    assert report["accuracy"] == 0.5
    assert report["per_lot"]["T2"]["recall"] == 0


@pytest.mark.parametrize("architecture", ["cnn", "cnn_lstm"])
def test_heads_use_spatial_tokens_and_return_independent_targets(architecture):
    head = QualityHead(architecture, 12, len(NUMERIC_KEYS), [3, 2])
    output, grades = head(torch.randn(2, 16, 12))
    assert output.shape == (2, len(NUMERIC_KEYS))
    assert [tuple(g.shape) for g in grades] == [(2, 3), (2, 2)]
    (output.square().mean() + sum(g.square().mean() for g in grades)).backward()
    assert head.numeric.weight.grad is not None


def test_capture_rejects_blank_photos():
    assert not capture_checks(Image.new("RGB", (300, 300), "white"))["passed"]
    assert not capture_checks(Image.new("RGB", (300, 300), "black"))["passed"]


def test_bad_capture_never_receives_numeric_or_reference_values(quality_artifact):
    result = QualityPredictor(quality_artifact).predict(Image.new("RGB", (300, 300), "white"))
    assert result["status"] == "withheld" and result["reference"] is None
    assert all(prop["value"] is None for prop in result["properties"])
    assert {p["key"] for p in result["properties"]} == set(NUMERIC_KEYS + CATEGORY_KEYS + ["amt", "grade"])


def test_mean_baseline_discloses_constant_predictions_and_withholds_unsupported_grades(quality_artifact):
    image = Image.fromarray(np.random.default_rng(2).integers(80, 220, (224, 224, 3), dtype=np.uint8))
    result = QualityPredictor(quality_artifact).predict(image)
    assert result["status"] == "experimental"
    assert any("do not depend on cotton appearance" in warning for warning in result["warnings"])
    assert result["reference"]["identity_verified"] is False
    for prop in result["properties"]:
        if prop["key"] in CATEGORY_KEYS:
            assert prop["value"] is None and prop["status"] == "not_validated"


def test_checksum_mismatch_fails_closed(quality_artifact):
    (quality_artifact.parent / "model/parameters.npz").write_bytes(b"damaged")
    with pytest.raises(QualityArtifactError, match="Checksum"):
        QualityPredictor(quality_artifact)


def test_activation_cannot_escape_model_root(tmp_path):
    active = tmp_path / "active.json"
    active.write_text(json.dumps({"schema_version": 1, "artifact": "../secret", "sha256": "unused"}))
    with pytest.raises(QualityArtifactError, match="escapes"):
        QualityPredictor(active)

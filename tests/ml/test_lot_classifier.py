"""Classifier export equivalence, photo partitioning and serving-integrity regressions."""

from __future__ import annotations

import json

import numpy as np
import pytest
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from torchvision.models import mobilenet_v3_small

from ml.quality.lot_classifier import LotCNN, fit_cnn, fit_linear, linear_scores
from ml.quality.predictor import QualityArtifactError, QualityPredictor, sha256
from ml.quality.train_matching import selection_split
from tests.ml.test_quality import quality_artifact as base_quality_artifact


@pytest.fixture
def classifier_artifact(tmp_path):
    return base_quality_artifact.__wrapped__(tmp_path)


@pytest.mark.parametrize("class_count", [2, 3])
def test_numeric_export_matches_sklearn_classification_and_train_only_scaling(class_count):
    rng = np.random.default_rng(3)
    targets = np.repeat(np.arange(class_count), 8)
    vectors = rng.normal(size=(len(targets), 5)) + targets[:, None] * 3
    train = np.concatenate([np.flatnonzero(targets == value)[:6] for value in range(class_count)])
    fit = fit_linear(vectors, targets, train)
    sklearn_model = make_pipeline(StandardScaler(), LogisticRegression(C=1, class_weight="balanced", max_iter=2000, random_state=42))
    sklearn_model.fit(vectors[train], targets[train])
    assert np.array_equal(fit["classes"][linear_scores(fit, vectors).argmax(1)], sklearn_model.predict(vectors))
    changed = vectors.copy()
    changed[np.setdiff1d(np.arange(len(vectors)), train)] = 100000
    again = fit_linear(changed, targets, train)
    assert np.array_equal(fit["mean"], again["mean"])
    assert np.array_equal(fit["coef"], again["coef"])


def test_nested_selection_never_sees_outer_query_photographs():
    targets = np.repeat(np.arange(3), 20)
    outer_train = np.concatenate([np.flatnonzero(targets == value)[:16] for value in range(3)])
    outer_query = np.setdiff1d(np.arange(len(targets)), outer_train)
    train, validation = selection_split(targets, outer_train, 42)
    assert not set(train) & set(validation)
    assert set(train) | set(validation) == set(outer_train)
    assert not (set(train) | set(validation)) & set(outer_query)
    assert set(targets[train]) == set(targets[validation]) == {0, 1, 2}


def test_fine_tuning_updates_late_weights_without_changing_batchnorm_statistics():
    torch.set_num_threads(2)
    model = LotCNN(mobilenet_v3_small(weights=None).features, 2)
    before = {key: value.clone() for key, value in model.state_dict().items() if "running_" in key}
    model.train()
    model(torch.randn(4, 48, 4, 4)).square().mean().backward()
    assert model.tail[0].block[0][0].weight.grad is not None
    assert all(torch.equal(before[key], model.state_dict()[key]) for key in before)


def test_cnn_rejects_overlapping_training_and_validation_photos():
    with pytest.raises(ValueError, match="disjoint"):
        fit_cnn(torch.zeros(4, 2, 48, 4, 4), np.array([0, 0, 1, 1]), np.array([0, 2]), np.array([0, 3]), "unused")


def install_fixture_classifier(active):
    root = active.parent / "model"
    meta = json.loads((root / "artifact.json").read_text())
    meta["matching_classifier"] = {
        "schema_version": 1,
        "kind": "linear",
        "model": "logistic_224",
        "name": "Synthetic fixture classifier",
        "classes": ["T1", "T2"],
        "image_size": 224,
    }
    np.savez(root / "lot_classifier.npz", mean=np.zeros(576), scale=np.ones(576), coef=np.zeros((1, 576)), intercept=np.array([10.0]))
    meta["files"]["lot_classifier.npz"] = sha256(root / "lot_classifier.npz")
    (root / "artifact.json").write_text(json.dumps(meta))
    pointer = json.loads(active.read_text())
    pointer["sha256"] = sha256(root / "artifact.json")
    active.write_text(json.dumps(pointer))


def test_trained_reference_match_does_not_replace_numeric_predictions(classifier_artifact):
    image = Image.fromarray(np.random.default_rng(2).integers(80, 220, (224, 224, 3), dtype=np.uint8))
    before = QualityPredictor(classifier_artifact).predict(image)
    assert before["reference"]["lot_id"] == "T1"
    install_fixture_classifier(classifier_artifact)
    after = QualityPredictor(classifier_artifact).predict(image)
    assert after["reference"]["lot_id"] == "T2"
    assert after["reference"]["method"] == "logistic_224"
    assert after["reference"]["report"]["lot_id"] == "T2"
    assert after["reference"]["identity_verified"] is False
    assert after["properties"] == before["properties"]


def test_tampered_classifier_fails_closed(classifier_artifact):
    install_fixture_classifier(classifier_artifact)
    (classifier_artifact.parent / "model/lot_classifier.npz").write_bytes(b"invalid")
    with pytest.raises(QualityArtifactError, match="Checksum"):
        QualityPredictor(classifier_artifact)


def test_convnext_view_modes_preserve_one_row_per_source_photo():
    from ml.quality.train_convnext_matching import feature_vectors

    views = np.arange(2 * 5 * 3, dtype=np.float32).reshape(2, 5, 3)
    assert np.array_equal(feature_vectors(views, "single"), views[:, 0])
    assert np.array_equal(feature_vectors(views, "mean"), views[:, :4].mean(1))
    assert np.array_equal(feature_vectors(views, "highres"), views[:, 4])
    assert np.array_equal(feature_vectors(views, "multiscale"), np.concatenate([views[:, 0], views[:, 4]], axis=1))
    assert feature_vectors(views, "original_and_mean").shape == (2, 6)
    changed = views.copy()
    changed[:, 4] = 10000
    assert np.array_equal(feature_vectors(views, "mean"), feature_vectors(changed, "mean"))


def test_convnext_nested_selection_isolates_every_query_from_all_inner_fits():
    from ml.quality.train_convnext_matching import evaluate_candidates

    groups = np.repeat(["T1", "T2"], 10)
    views = np.repeat(np.repeat(np.eye(2), 10, axis=0)[:, None], 5, axis=1)
    report = evaluate_candidates(views, groups)
    queries = []
    for fold in report["folds"]:
        train, query = set(fold["train_indices"]), set(fold["query_indices"])
        assert not train & query
        queries.extend(query)
        for inner in fold["inner_folds"]:
            a, b = set(inner["train_indices"]), set(inner["validation_indices"])
            assert not a & b and a | b == train
            assert not (a | b) & query
    assert sorted(queries) == list(range(20))
    assert report["correct"] == 20 and report["total"] == 20

from __future__ import annotations

import numpy as np
from PIL import Image

from ml.calibration import calibrate, expected_calibration_error, softmax_np
from ml.inference import MockPredictor, build_predictor
from ml.ood import ConfidenceThresholdRejector, EnergyScoreRejector, build_rejector, confidence_level
from ml.training.metrics import compute_classification_metrics, top_k_accuracy


def _img(seed: int = 0) -> Image.Image:
    return Image.fromarray((np.random.default_rng(seed).random((200, 260, 3)) * 255).astype("uint8"))


def test_mock_predictor_is_deterministic_and_flagged():
    p = MockPredictor(["A", "B", "C", "D"], image_size=128)
    out1 = p.predict(_img(1), top_k=3, explain=True)
    out2 = p.predict(_img(1), top_k=3, explain=False)
    assert out1.is_mock and out1.model_name == "mock-demo-predictor"
    assert out1.class_name == out2.class_name and out1.calibrated_confidence == out2.calibrated_confidence
    assert len(out1.top_predictions) == 3 and out1.top_predictions[0].class_name == out1.class_name
    assert abs(sum(t.raw_probability for t in p.predict(_img(1), top_k=4).top_predictions) - 1) < 1e-6
    assert out1.gradcam_image is not None and out1.gradcam_image.size == (128, 128)
    assert out1.timings.total_ms > 0 and out1.timings.explainability_ms > 0
    assert p.predict(_img(2)).class_name in p.class_names


def test_build_predictor_mock_uses_fallback_classes(tmp_path):
    reg = tmp_path / "registry.json"
    reg.write_text('{"schema_version": 1, "active_model": null, "models": []}')
    p = build_predictor("mock", reg, ["X", "Y", "Z"], unknown_threshold=0.5, warm=False)
    assert p.class_names == ["X", "Y", "Z"] and p.info()["ood"]["threshold"] == 0.5


def test_threshold_and_energy_rejectors():
    logits = np.array([4.0, 0.5, 0.1])
    probs = softmax_np(logits)
    assert ConfidenceThresholdRejector(0.6).decide(logits, probs).is_unknown is False
    d = ConfidenceThresholdRejector(0.99).decide(logits, probs)
    assert d.is_unknown and "below threshold" in d.reason
    flat = np.array([0.1, 0.1, 0.1])
    assert EnergyScoreRejector(energy_threshold=-2.0).decide(flat, softmax_np(flat)).is_unknown
    assert build_rejector({"strategy": "confidence_threshold", "threshold": 0.7}).threshold == 0.7
    comp = build_rejector(
        {"strategy": "composite", "members": [{"strategy": "confidence_threshold", "threshold": 0.2}, {"strategy": "energy", "energy_threshold": 100}]}
    )
    assert comp.decide(logits, probs).is_unknown is False
    assert (
        confidence_level(0.9, False) == "high"
        and confidence_level(0.7, False) == "medium"
        and confidence_level(0.5, False) == "low"
        and confidence_level(0.9, True) == "unknown"
    )


def test_metrics_bundle_values():
    class_names = ["A", "B", "C"]
    y_true = np.array([0, 0, 1, 1, 2, 2])
    y_pred = np.array([0, 0, 1, 2, 2, 2])
    probs = np.full((6, 3), 0.1)
    probs[np.arange(6), y_pred] = 0.8
    m = compute_classification_metrics(y_true, y_pred, probs, class_names)
    assert abs(m["accuracy"] - 5 / 6) < 1e-9 and m["per_class"]["B"]["recall"] == 0.5
    assert m["confusion_matrix"][1] == [0, 1, 1] and 0 < m["macro_f1"] < 1
    assert m["top2_accuracy"] is not None and m["top3_accuracy"] is None  # top-3 undefined with 3 classes
    assert top_k_accuracy(y_true, probs, 2) >= m["accuracy"]


def test_temperature_scaling_reduces_nll_of_overconfident_logits():
    rng = np.random.default_rng(0)
    n, k = 600, 4
    labels = rng.integers(0, k, n)
    logits = rng.normal(0, 1, (n, k))
    logits[np.arange(n), labels] += 1.0
    logits *= 4.0  # artificially over-confident
    res = calibrate(logits, labels)
    assert res.temperature > 1.5 and res.nll_after < res.nll_before and res.ece_after < res.ece_before
    ece, table = expected_calibration_error(softmax_np(logits, res.temperature), labels)
    assert 0 <= ece <= 1 and len(table) == 15

"""Progressive checkpoint identity, head removal and shared-serving lineage regressions."""

from __future__ import annotations

import json

import numpy as np
import pytest
import torch
from torch.torch_version import TorchVersion

from ml.quality.model import image_tokens
from ml.quality.predictor import QualityArtifactError, QualityPredictor, sha256
from ml.quality.progressive_encoder import CHANNELS, ENCODER, HEAD_KEYS, checkpoint_backbone, headless_model
from tests.ml.test_quality import quality_artifact as base_quality_artifact


@pytest.fixture
def original_seed(tmp_path):
    torch.set_num_threads(2)
    model = headless_model()
    state = model.state_dict()
    state["head.fc.weight"] = torch.ones(3, CHANNELS)
    state["head.fc.bias"] = torch.ones(3)
    payload = {
        "model_state_dict": state,
        "architecture": "convnext_tiny",
        "experiment_name": "pt_progressive_seed",
        "epoch": 9,
        "class_names": ["a", "b", "c"],
        "torch_version": TorchVersion(torch.__version__),
        "lineage": {"transfer_source": "pt_progressive_leaf", "transfer": {"loaded_tensors": 180, "missing_keys": sorted(HEAD_KEYS)}},
    }
    path = tmp_path / "seed.pt"
    torch.save(payload, path)
    return path


def test_conversion_preserves_every_backbone_tensor_and_discards_both_old_heads(original_seed):
    state, proof = checkpoint_backbone(original_seed, "seed")
    assert len(state) == proof["transferred_tensors"] == 180
    assert not HEAD_KEYS & state.keys()
    with torch.serialization.safe_globals([TorchVersion]):
        original = torch.load(original_seed, weights_only=True)["model_state_dict"]
    assert all(torch.equal(value, original[key]) for key, value in state.items())
    assert proof["stages"] == ["ImageNet", "cotton leaves", "cotton seeds"]
    assert proof["source_checkpoint_sha256"] == sha256(original_seed)
    with pytest.raises(ValueError, match="stage"):
        checkpoint_backbone(original_seed, "leaf")


def test_seed_without_recorded_leaf_transfer_is_rejected(original_seed):
    with torch.serialization.safe_globals([TorchVersion]):
        payload = torch.load(original_seed, weights_only=True)
    payload["lineage"]["transfer_source"] = "ImageNet"
    torch.save(payload, original_seed)
    with pytest.raises(ValueError, match="leaf-to-seed"):
        checkpoint_backbone(original_seed, "seed")


def test_progressive_serving_shares_one_verified_encoder_and_rejects_lineage_tampering(tmp_path, original_seed):
    from PIL import Image

    active = base_quality_artifact.__wrapped__(tmp_path)
    root = active.parent / "model"
    state, proof = checkpoint_backbone(original_seed, "seed")
    torch.save(state, root / "backbone.pt")
    proof["exported_backbone_sha256"] = sha256(root / "backbone.pt")
    meta = json.loads((root / "artifact.json").read_text())
    with np.load(root / "parameters.npz") as archive:
        parameters = {key: archive[key].copy() for key in archive.files}
    parameters.update(x_mean=np.zeros(CHANNELS), x_scale=np.ones(CHANNELS))
    np.savez(root / "parameters.npz", **parameters)
    np.savez(root / "references.npz", vectors=np.ones((2, CHANNELS)))
    np.savez(root / "lot_classifier.npz", mean=np.zeros(CHANNELS), scale=np.ones(CHANNELS), coef=np.zeros((1, CHANNELS)), intercept=np.ones(1))
    report = json.loads((root / "evaluation.json").read_text())
    report["transfer_learning"] = proof
    (root / "evaluation.json").write_text(json.dumps(report))
    meta.update(
        encoder=ENCODER,
        feature_channels=CHANNELS,
        transfer_learning=proof,
        matching_classifier={
            "schema_version": 1,
            "kind": "linear",
            "model": "synthetic_progressive",
            "name": "Synthetic",
            "classes": ["T1", "T2"],
            "image_size": 224,
            "resize_size": 236,
            "view_mode": "single",
            "encoder": ENCODER,
            "encoder_sha256": proof["exported_backbone_sha256"],
        },
    )
    meta["files"]["lot_classifier.npz"] = "pending"

    def update():
        meta["files"] = {name: sha256(root / name) for name in meta["files"]}
        (root / "artifact.json").write_text(json.dumps(meta))
        pointer = json.loads(active.read_text())
        pointer["sha256"] = sha256(root / "artifact.json")
        active.write_text(json.dumps(pointer))

    update()
    predictor = QualityPredictor(active)
    assert predictor.encoder is predictor.lot_classifier.encoder
    image = Image.fromarray(np.random.default_rng(1).integers(80, 200, (224, 224, 3), dtype=np.uint8))
    assert image_tokens(predictor.encoder, [image]).shape == (1, 16, CHANNELS)
    assert predictor.predict(image)["reference"]["lot_id"] == "T2"
    assert predictor.status()["protocol"]["transfer_learning"]["source_checkpoint_sha256"] == sha256(original_seed)
    meta["transfer_learning"] = {**proof, "exported_backbone_sha256": "wrong-source"}
    update()
    with pytest.raises(QualityArtifactError, match="lineage"):
        QualityPredictor(active)
    meta["transfer_learning"] = proof
    meta["matching_classifier"]["encoder"] = "convnext_tiny"
    update()
    with pytest.raises(QualityArtifactError, match="share the transferred backbone"):
        QualityPredictor(active)

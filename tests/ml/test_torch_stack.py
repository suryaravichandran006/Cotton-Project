"""Tests that need PyTorch + timm. Skipped automatically when they are not installed."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("timm")
pytestmark = pytest.mark.torch


def test_model_factory_and_gradcam_layers():
    from ml.models.factory import get_architecture_spec, get_model, list_architectures, resolve_gradcam_layer

    names = [s.name for s in list_architectures()]
    assert {"resnet50", "efficientnetv2_s", "convnext_tiny", "mobilenetv3_large"} <= set(names)
    model = get_model("mobilenetv3_large", num_classes=5, pretrained=False)
    model.eval()
    with torch.inference_mode():
        out = model(torch.randn(2, 3, 224, 224))
    assert out.shape == (2, 5)
    layer = resolve_gradcam_layer(model, get_architecture_spec("mobilenetv3_large").gradcam_layer)
    assert isinstance(layer, torch.nn.Module)


def test_gradcam_heatmap_shape():
    from PIL import Image

    from ml.explain.gradcam import GradCAM, heatmap_to_overlay
    from ml.models.factory import get_architecture_spec, get_model, resolve_gradcam_layer

    model = get_model("mobilenetv3_large", num_classes=3, pretrained=False)
    cam = GradCAM(model, resolve_gradcam_layer(model, get_architecture_spec("mobilenetv3_large").gradcam_layer))
    heat, logits = cam(torch.randn(1, 3, 128, 128), class_idx=1)
    cam.remove()
    assert heat.shape == (128, 128) and 0 <= heat.min() and heat.max() <= 1 and logits.shape == (1, 3)
    overlay = heatmap_to_overlay(Image.new("RGB", (128, 128)), heat, label="TEST")
    assert overlay.size == (128, 128)


def test_transforms_output_tensor_shapes():
    from ml.config import load_augmentation_preset
    from ml.data.transforms import build_eval_transform, build_train_transform

    img = (np.random.default_rng(0).random((300, 400, 3)) * 255).astype("uint8")
    train_t = build_train_transform(96, load_augmentation_preset("default"))
    eval_t = build_eval_transform(96)
    assert tuple(train_t(image=img)["image"].shape) == (3, 96, 96)
    assert tuple(eval_t(image=img)["image"].shape) == (3, 96, 96)


def test_checkpoint_roundtrip_and_torch_predictor(tmp_path: Path):
    from PIL import Image

    from ml.config import TrainConfig
    from ml.inference.torch_predictor import TorchPredictor
    from ml.models.factory import get_model
    from ml.ood import ConfidenceThresholdRejector
    from ml.registry import ModelEntry
    from ml.training.trainer import build_checkpoint_payload, load_checkpoint

    cfg = TrainConfig(architecture="mobilenetv3_large", image_size=96, epochs=1)
    class_names = ["Alpha", "Beta", "Gamma"]
    model = get_model(cfg.architecture, len(class_names), pretrained=False)
    ckpt = tmp_path / "best.pt"
    torch.save(build_checkpoint_payload(model, cfg, class_names, epoch=1, metrics={}, calibration_temperature=1.7), ckpt)
    payload = load_checkpoint(ckpt)
    assert payload["class_names"] == class_names and payload["calibration_temperature"] == 1.7

    entry = ModelEntry(name="t", version="0.1", architecture=cfg.architecture, checkpoint=str(ckpt), class_names=class_names, image_size=96)
    predictor = TorchPredictor(entry, ConfidenceThresholdRejector(0.0), device="cpu", warm=False)
    out = predictor.predict(Image.new("RGB", (120, 100), (200, 190, 180)), top_k=3, explain=True)
    assert not out.is_mock and out.calibration_temperature == 1.7 and out.class_name in class_names
    assert out.gradcam_image is not None and out.gradcam_image.size == (96, 96)
    assert out.explanation_error is None

    (tmp_path / "corrupt.pt").write_bytes(b"not a checkpoint")
    with pytest.raises(RuntimeError):
        load_checkpoint(tmp_path / "corrupt.pt")

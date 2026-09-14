from __future__ import annotations

from pathlib import Path

import torch
from torch import nn

from ml.models.factory import load_transfer_weights


class TinyTransferNet(nn.Module):
    def __init__(self, classes: int):
        super().__init__()
        self.features = nn.Sequential(nn.Linear(4, 4), nn.ReLU())
        self.head = nn.Linear(4, classes)


def test_transfer_loads_backbone_and_skips_old_head(tmp_path: Path):
    source = TinyTransferNet(classes=3)
    with torch.no_grad():
        source.features[0].weight.fill_(0.25)
        source.features[0].bias.fill_(0.5)
        source.head.weight.fill_(9.0)

    checkpoint = tmp_path / "leaf.pt"
    torch.save(
        {
            "model_state_dict": source.state_dict(),
            "architecture": "convnext_tiny",
            "class_names": ["a", "b", "c"],
            "image_size": 224,
        },
        checkpoint,
    )

    target = TinyTransferNet(classes=5)
    original_head = target.head.weight.detach().clone()
    report = load_transfer_weights(target, checkpoint)

    assert torch.allclose(target.features[0].weight, torch.full_like(target.features[0].weight, 0.25))
    assert torch.allclose(target.features[0].bias, torch.full_like(target.features[0].bias, 0.5))
    assert torch.allclose(target.head.weight, original_head)
    assert report["loaded_tensors"] == 2
    assert report["skipped_tensors"] >= 2
    assert report["source_classes"] == ["a", "b", "c"]

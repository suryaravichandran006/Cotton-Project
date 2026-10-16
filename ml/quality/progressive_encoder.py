"""Strict conversion of the original leaf/seed checkpoints into a headless timm encoder."""

from __future__ import annotations

import hashlib
from pathlib import Path

import torch
from torch import nn
from torch.torch_version import TorchVersion

ENCODER = "timm_convnext_tiny"
CHANNELS = 768
HEAD_KEYS = {"head.fc.weight", "head.fc.bias"}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def headless_model():
    import timm

    return timm.create_model("convnext_tiny", pretrained=False, num_classes=0)


def checkpoint_backbone(path, stage: str):
    """Only allow TorchVersion metadata in addition to PyTorch's restricted loader."""
    if stage not in {"leaf", "seed"}:
        raise ValueError("Expected leaf or seed checkpoint")
    with torch.serialization.safe_globals([TorchVersion]):
        payload = torch.load(path, map_location="cpu", weights_only=True)
    if payload.get("architecture") != "convnext_tiny" or payload.get("experiment_name") != f"pt_progressive_{stage}":
        raise ValueError("Checkpoint architecture or training stage does not match")
    lineage = payload.get("lineage", {})
    transfer = lineage.get("transfer") or {}
    if stage == "seed" and (
        lineage.get("transfer_source") != "pt_progressive_leaf" or transfer.get("loaded_tensors") != 180 or set(transfer.get("missing_keys", [])) != HEAD_KEYS
    ):
        raise ValueError("Seed checkpoint lacks the recorded leaf-to-seed transfer")
    state = payload["model_state_dict"]
    if not HEAD_KEYS <= state.keys():
        raise ValueError("Original task head is missing")
    # Discard both task-head tensors even when a new task has the same class count.
    state = {key: value for key, value in state.items() if key not in HEAD_KEYS}
    model = headless_model()
    model.load_state_dict(state, strict=True)
    if any(not torch.isfinite(value).all() for value in state.values()):
        raise ValueError("Non-finite checkpoint tensor")
    return state, {
        "route": "progressive" if stage == "seed" else "leaf_to_cotton",
        "stages": ["ImageNet", "cotton leaves", "cotton seeds"] if stage == "seed" else ["ImageNet", "cotton leaves"],
        "source_checkpoint_sha256": digest(path),
        "source_epoch": payload["epoch"],
        "source_classes": payload["class_names"],
        "transferred_tensors": len(state),
        "discarded_task_tensors": sorted(HEAD_KEYS),
        "recorded_lineage": lineage,
        "verification_scope": "Checkpoint bytes and recorded training lineage; original training did not attest its parent checkpoint hash.",
    }


class TimmCottonEncoder(nn.Module):
    def __init__(self, state_path):
        super().__init__()
        self.model = headless_model()
        self.model.load_state_dict(torch.load(state_path, map_location="cpu", weights_only=True), strict=True)
        if any(not torch.isfinite(value).all() for value in self.model.state_dict().values()):
            raise ValueError("Non-finite progressive encoder tensor")
        self.eval().requires_grad_(False)

    def forward(self, tensor):
        return self.model.forward_features(tensor)

    def pooled(self, tensor):
        return self.model.forward_head(self(tensor), pre_logits=True)

"""Frozen ImageNet encoder with either pooling or an explicitly spatial LSTM head."""

from __future__ import annotations

import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision.models import mobilenet_v3_small

from ml.data.preprocessing import PreprocessConfig, load_image, preprocess_image

IMAGE_SIZE = 224
TOKEN_GRID = 4
FEATURE_CHANNELS = 576


def make_encoder(state_path, device: str = "cpu", encoder_name: str = "torchvision_mobilenet_v3_small_imagenet1k_v1"):
    if encoder_name == "timm_convnext_tiny":
        from ml.quality.progressive_encoder import TimmCottonEncoder

        return TimmCottonEncoder(state_path).to(device)
    if encoder_name != "torchvision_mobilenet_v3_small_imagenet1k_v1":
        raise ValueError("Unsupported property encoder")
    encoder = mobilenet_v3_small(weights=None).features
    encoder.load_state_dict(torch.load(state_path, map_location="cpu", weights_only=True), strict=True)
    return encoder.eval().requires_grad_(False).to(device)


@torch.inference_mode()
def image_tokens(encoder, images: list[Image.Image], device: str = "cpu") -> np.ndarray:
    arrays = [preprocess_image(load_image(im), PreprocessConfig(image_size=IMAGE_SIZE))[0] for im in images]
    tensor = torch.from_numpy(np.stack(arrays)).to(device)
    features = encoder(tensor)
    # Apple's backend cannot pool a 7x7 map to 4x4; keep this exact operation
    # on CPU there, matching the CPU serving path rather than resizing features.
    if features.device.type == "mps":
        features = features.cpu()
    features = torch.nn.functional.adaptive_avg_pool2d(features, (TOKEN_GRID, TOKEN_GRID))
    return features.flatten(2).transpose(1, 2).cpu().numpy()


class QualityHead(nn.Module):
    def __init__(self, architecture: str, channels: int, numeric_count: int, category_sizes: list[int], hidden: int = 32):
        super().__init__()
        if architecture not in {"cnn", "cnn_lstm"}:
            raise ValueError("Unknown quality head")
        self.architecture = architecture
        self.project = nn.Sequential(nn.Linear(channels, hidden), nn.GELU())
        self.sequence = nn.LSTM(hidden, hidden, batch_first=True) if architecture == "cnn_lstm" else None
        self.dropout = nn.Dropout(0.2)
        self.numeric = nn.Linear(hidden, numeric_count)
        self.categories = nn.ModuleList(nn.Linear(hidden, n) for n in category_sizes)

    def forward(self, tokens):
        tokens = self.project(tokens)
        if self.sequence is not None:
            # Row-major traversal of spatial features from ONE photo; no fabricated time axis.
            tokens, _ = self.sequence(tokens)
        pooled = self.dropout(tokens.mean(dim=1))
        return self.numeric(pooled), [head(pooled) for head in self.categories]

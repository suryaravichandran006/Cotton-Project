"""Restore the official timm starting weights used by the supplied leaf training notebook."""

from __future__ import annotations

import json

from ml.quality.progressive_encoder import digest
from ml.quality.train import write_json
from ml.utils.paths import REPO_ROOT


def main():
    import timm
    import torch

    root = REPO_ROOT / "models/quality/encoders"
    root.mkdir(parents=True, exist_ok=True)
    path = root / "timm_convnext_tiny_in12k_ft_in1k.pt"
    meta_path = path.with_suffix(".json")
    if path.is_file() and meta_path.is_file():
        meta = json.loads(meta_path.read_text())
        if meta.get("model") != "timm/convnext_tiny.in12k_ft_in1k" or meta.get("sha256") != digest(path):
            raise ValueError("Existing direct baseline has inconsistent identity or hash")
    else:
        model = timm.create_model("convnext_tiny.in12k_ft_in1k", pretrained=True, num_classes=0)
        torch.save(model.state_dict(), path)
        write_json(meta_path, {"model": "timm/convnext_tiny.in12k_ft_in1k", "sha256": digest(path), "pretrained_config": model.pretrained_cfg})
    print(f"Verified direct control: {path}")


if __name__ == "__main__":
    main()

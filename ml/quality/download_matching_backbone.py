"""Download the official ConvNeXt-Tiny checkpoint for the known-lot classifier."""

from __future__ import annotations

from ml.quality.predictor import sha256
from ml.utils.paths import REPO_ROOT


def main():
    import torch
    from torchvision.models import ConvNeXt_Tiny_Weights

    root = REPO_ROOT / "models/quality/encoders"
    root.mkdir(parents=True, exist_ok=True)
    target = root / "convnext_tiny-983f1562.pth"
    if target.is_file() and sha256(target).startswith("983f1562"):
        print(f"Verified official ConvNeXt checkpoint: {target}")
        return
    temporary = target.with_suffix(".download")
    try:
        torch.hub.download_url_to_file(ConvNeXt_Tiny_Weights.IMAGENET1K_V1.url, str(temporary), hash_prefix="983f1562", progress=True)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Saved official ConvNeXt checkpoint: {target}")


if __name__ == "__main__":
    main()

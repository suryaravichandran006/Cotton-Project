"""Download official ImageNet weights into the project's model directory."""

from ml.utils.paths import REPO_ROOT


def main() -> None:
    import torch
    from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

    root = REPO_ROOT / "models/quality"
    root.mkdir(parents=True, exist_ok=True)
    torch.hub.set_dir(str(root / "cache"))
    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    target = root / "backbone.pt"
    torch.save(model.features.state_dict(), target)
    print(f"Saved official pretrained encoder: {target}")


if __name__ == "__main__":
    main()

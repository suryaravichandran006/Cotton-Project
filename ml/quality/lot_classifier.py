"""Dedicated known-lot classifiers; numeric property regression remains independent."""

from __future__ import annotations

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from torch import nn
from torchvision.models import ConvNeXt_Tiny_Weights, convnext_tiny, mobilenet_v3_small

from ml.data.preprocessing import PreprocessConfig, load_image, preprocess_image

PREFIX_BLOCKS = 9
CLASSIFIER_SIZE = 336


class LotCNN(nn.Module):
    """Fine-tune four late MobileNet blocks; pretrained early blocks and BN statistics stay frozen."""

    def __init__(self, backbone, class_count: int):
        super().__init__()
        self.tail = backbone[PREFIX_BLOCKS:]
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.2), nn.Linear(576, class_count))
        self.tail.requires_grad_(True)

    def train(self, mode: bool = True):
        super().train(mode)
        # Tiny lot batches must not overwrite ImageNet batch-normalization statistics.
        for layer in self.tail.modules():
            if isinstance(layer, nn.BatchNorm2d):
                layer.eval()
        return self

    def forward(self, prefix_features):
        return self.head(self.tail(prefix_features))


def fit_linear(vectors: np.ndarray, labels: np.ndarray, indices: np.ndarray, c: float = 1.0) -> dict:
    estimator = make_pipeline(StandardScaler(), LogisticRegression(C=c, class_weight="balanced", max_iter=2000, random_state=42))
    estimator.fit(vectors[indices], labels[indices])
    scale, classifier = estimator.steps[0][1], estimator.steps[1][1]
    return {
        "mean": scale.mean_.astype(np.float32),
        "scale": scale.scale_.astype(np.float32),
        "coef": classifier.coef_.astype(np.float32),
        "intercept": classifier.intercept_.astype(np.float32),
        "classes": classifier.classes_,
    }


def linear_scores(parameters: dict, vectors: np.ndarray) -> np.ndarray:
    scores = ((vectors - parameters["mean"]) / parameters["scale"]) @ parameters["coef"].T + parameters["intercept"]
    # sklearn's two-class logistic representation contains one positive-class coefficient row.
    return np.concatenate([-scores, scores], axis=1) if scores.shape[1] == 1 else scores


def fit_cnn(
    prefix_views: torch.Tensor,
    targets: np.ndarray,
    train: np.ndarray,
    validation: np.ndarray | None,
    backbone_path,
    epochs: int = 25,
    seed: int = 42,
    fixed_epochs: int | None = None,
    batch_size: int = 24,
) -> dict:
    if fixed_epochs is None and validation is None:
        raise ValueError("Validation photos are required unless a fixed epoch count was selected")
    if validation is not None and set(train.tolist()) & set(validation.tolist()):
        raise ValueError("Classifier training and validation photographs must be disjoint")
    torch.manual_seed(seed)
    backbone = mobilenet_v3_small(weights=None).features
    backbone.load_state_dict(torch.load(backbone_path, map_location="cpu", weights_only=True), strict=True)
    model = LotCNN(backbone, int(targets.max()) + 1)
    optimizer = torch.optim.AdamW(
        [
            {"params": model.tail.parameters(), "lr": 0.00015},
            {"params": model.head.parameters(), "lr": 0.002},
        ],
        weight_decay=0.01,
    )
    counts = np.bincount(targets[train], minlength=int(targets.max()) + 1)
    if np.any(counts == 0):
        raise ValueError("Every known lot must be represented in classifier training")
    weights = torch.tensor(len(train) / (len(counts) * counts), dtype=torch.float32)
    truth = torch.tensor(targets, dtype=torch.long)
    generator = torch.Generator().manual_seed(seed)
    best, best_epoch, best_state, stale = -1.0, 0, None, 0
    from sklearn.metrics import balanced_accuracy_score

    for epoch in range(1, (fixed_epochs or epochs) + 1):
        model.train()
        order = train[torch.randperm(len(train), generator=generator).numpy()]
        for offset in range(0, len(order), batch_size):
            indices = order[offset : offset + batch_size]
            variants = torch.randint(prefix_views.shape[1], (len(indices),), generator=generator)
            features = prefix_views[indices, variants]
            optimizer.zero_grad()
            logits = model(features)
            loss = nn.functional.cross_entropy(logits, truth[indices], weight=weights)
            if not torch.isfinite(loss):
                raise RuntimeError("Non-finite classifier training loss")
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
        if fixed_epochs:
            best_epoch = epoch
            if epoch % 5 == 0 or epoch == 1:
                print(f"  CNN fixed-epoch refit: {epoch}/{fixed_epochs}", flush=True)
            continue
        predicted = cnn_scores(model, prefix_views[validation, 0], batch_size).argmax(1)
        score = float(balanced_accuracy_score(targets[validation], predicted))
        if score > best + 1e-6:
            best, best_epoch, stale = score, epoch, 0
            best_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
        else:
            stale += 1
        if epoch % 5 == 0 or epoch == 1:
            print(f"  CNN epoch {epoch}: validation balanced accuracy={score:.3f}, best={best:.3f}", flush=True)
        if stale >= 7:
            break
    if best_state is not None:
        model.load_state_dict(best_state)
    return {"model": model.eval(), "epoch": best_epoch, "validation_score": best}


@torch.inference_mode()
def cnn_scores(model: LotCNN, features: torch.Tensor, batch_size: int = 24) -> np.ndarray:
    model.eval()
    return np.concatenate([model(features[offset : offset + batch_size]).numpy() for offset in range(0, len(features), batch_size)])


class InstalledLotClassifier:
    """Load only numeric arrays or weights-only Torch checkpoints, never pickled estimators."""

    def __init__(self, root, config: dict, backbone_path, property_encoder=None):
        if config.get("schema_version") != 1 or config.get("kind") not in {"linear", "cnn"}:
            raise ValueError("Incompatible lot classifier")
        self.config, self.classes = config, config["classes"]
        if len(self.classes) < 2 or len(set(self.classes)) != len(self.classes):
            raise ValueError("Invalid lot classifier classes")
        self.kind, self.image_size = config["kind"], config["image_size"]
        if self.image_size not in {224, CLASSIFIER_SIZE}:
            raise ValueError("Unsupported lot classifier image size")
        self.encoder_name = config.get("encoder", "mobilenet_v3_small")
        self.view_mode = config.get("view_mode", "single")
        if self.encoder_name not in {"mobilenet_v3_small", "convnext_tiny", "timm_convnext_tiny"} or self.view_mode not in {
            "single",
            "mean",
            "original_and_mean",
            "highres",
            "multiscale",
        }:
            raise ValueError("Unsupported classifier encoder or view mode")
        if self.encoder_name in {"convnext_tiny", "timm_convnext_tiny"}:
            if self.kind != "linear" or (self.view_mode == "highres" and self.image_size != 336) or (self.view_mode != "highres" and self.image_size != 224):
                raise ValueError("Incompatible ConvNeXt classifier")
            if config.get("resize_size") != (354 if self.view_mode == "highres" else 236):
                raise ValueError("Incompatible ConvNeXt resize configuration")
            if self.encoder_name == "timm_convnext_tiny":
                from ml.quality.progressive_encoder import TimmCottonEncoder

                self.encoder = property_encoder if isinstance(property_encoder, TimmCottonEncoder) else TimmCottonEncoder(backbone_path)
            else:
                model = convnext_tiny(weights=None)
                model.load_state_dict(torch.load(root / "lot_backbone.pt", map_location="cpu", weights_only=True), strict=True)
                self.encoder = nn.Sequential(model.features, model.avgpool, model.classifier[0], nn.Flatten())
            self.transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms()
            self.high_transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms(crop_size=336, resize_size=354)
            channels = 1536 if self.view_mode in {"original_and_mean", "multiscale"} else 768
        else:
            if self.view_mode != "single":
                raise ValueError("MobileNet classifier requires the single original view")
            self.encoder = mobilenet_v3_small(weights=None).features
            self.encoder.load_state_dict(torch.load(backbone_path, map_location="cpu", weights_only=True), strict=True)
            channels = 576
        self.encoder.eval().requires_grad_(False)
        if any(not torch.isfinite(value).all() for value in self.encoder.state_dict().values() if value.is_floating_point()):
            raise ValueError("Non-finite lot encoder weights")
        if self.kind == "linear":
            with np.load(root / "lot_classifier.npz", allow_pickle=False) as archive:
                self.parameters = {key: archive[key].copy() for key in archive.files}
            rows = 1 if len(self.classes) == 2 else len(self.classes)
            shapes = {"mean": (channels,), "scale": (channels,), "coef": (rows, channels), "intercept": (rows,)}
            for key, shape in shapes.items():
                if key not in self.parameters or self.parameters[key].shape != shape or not np.isfinite(self.parameters[key]).all():
                    raise ValueError(f"Invalid lot classifier parameter: {key}")
            if np.any(self.parameters["scale"] <= 0):
                raise ValueError("Invalid lot classifier feature scale")
        else:
            self.model = LotCNN(self.encoder, len(self.classes))
            self.model.load_state_dict(torch.load(root / "lot_classifier.pt", map_location="cpu", weights_only=True), strict=True)
            self.model.eval().requires_grad_(False)
            if any(not torch.isfinite(value).all() for value in self.model.state_dict().values() if value.is_floating_point()):
                raise ValueError("Non-finite lot classifier weights")

    @torch.inference_mode()
    def predict(self, image, original_tokens: np.ndarray) -> str:
        if self.encoder_name in {"convnext_tiny", "timm_convnext_tiny"}:
            from PIL import Image, ImageOps

            original = load_image(image)
            encode = self.encoder.pooled if self.encoder_name == "timm_convnext_tiny" else self.encoder
            if self.view_mode == "highres":
                vector = encode(self.high_transform(original)[None]).numpy()[0]
            elif self.view_mode == "multiscale":
                standard = encode(self.transform(original)[None]).numpy()[0]
                high = encode(self.high_transform(original)[None]).numpy()[0]
                vector = np.concatenate([standard, high])
            else:
                variants = (
                    [original]
                    if self.view_mode == "single"
                    else [original, ImageOps.mirror(original), original.transpose(Image.Transpose.ROTATE_90), original.transpose(Image.Transpose.ROTATE_180)]
                )
                features = encode(torch.stack([self.transform(variant) for variant in variants])).numpy()
                vector = features[0] if self.view_mode == "single" else features.mean(0)
                if self.view_mode == "original_and_mean":
                    vector = np.concatenate([features[0], vector])
            scores = linear_scores(self.parameters, vector[None])
        elif self.kind == "linear" and self.image_size == 224:
            scores = linear_scores(self.parameters, original_tokens.mean(1))
        else:
            array, _ = preprocess_image(load_image(image), PreprocessConfig(image_size=self.image_size))
            tensor = torch.from_numpy(array[None])
            if self.kind == "linear":
                # Match the 4x4 adaptive pooling used when encoding classifier features.
                features = nn.functional.adaptive_avg_pool2d(self.encoder(tensor), (4, 4)).flatten(2).mean(2).numpy()
                scores = linear_scores(self.parameters, features)
            else:
                scores = self.model(self.encoder[:PREFIX_BLOCKS](tensor)).numpy()
        if not np.isfinite(scores).all():
            raise ValueError("Lot classifier returned non-finite scores")
        return self.classes[int(scores.argmax(1)[0])]

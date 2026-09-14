"""PyTorch ``Dataset`` / ``DataLoader`` construction from split CSVs."""

from __future__ import annotations

from collections import Counter
from typing import Callable

import numpy as np
import torch
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, Dataset

from ml.data.discovery import ImageRecord
from ml.utils.seed import seed_worker


class CottonImageDataset(Dataset):
    """Loads RGB images from :class:`ImageRecord` lists and applies a transform."""

    def __init__(
        self,
        records: list[ImageRecord],
        class_names: list[str],
        transform: Callable | None = None,
    ) -> None:
        self.records = records
        self.class_names = class_names
        self.class_to_index = {c: i for i, c in enumerate(class_names)}
        self.transform = transform
        unknown = {r.class_name for r in records} - set(class_names)
        if unknown:
            raise ValueError(f"Records contain classes missing from class_names: {sorted(unknown)}")

    def __len__(self) -> int:
        return len(self.records)

    def labels(self) -> list[int]:
        return [self.class_to_index[r.class_name] for r in self.records]

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        rec = self.records[idx]
        with Image.open(rec.image_path) as im:
            im = ImageOps.exif_transpose(im) or im
            arr = np.asarray(im.convert("RGB"))
        x = self.transform(image=arr)["image"] if self.transform else torch.from_numpy(arr).permute(2, 0, 1).float() / 255
        return x, self.class_to_index[rec.class_name]


def compute_class_weights(labels: list[int], num_classes: int) -> torch.Tensor:
    """Inverse-frequency weights normalised to mean 1 (for ``CrossEntropyLoss(weight=...)``)."""
    counts = Counter(labels)
    freq = torch.tensor([counts.get(i, 0) for i in range(num_classes)], dtype=torch.float32)
    freq = torch.clamp(freq, min=1.0)
    w = 1.0 / freq
    return w * (num_classes / w.sum())


def make_dataloader(
    dataset: Dataset,
    batch_size: int,
    shuffle: bool,
    num_workers: int,
    seed: int,
    device: str = "cpu",
) -> DataLoader:
    g = torch.Generator()
    g.manual_seed(seed)
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=device == "cuda",
        worker_init_fn=seed_worker if num_workers > 0 else None,
        generator=g,
        drop_last=False,
        persistent_workers=num_workers > 0,
    )

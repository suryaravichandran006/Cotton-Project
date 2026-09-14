"""Discover images and class names from a folder tree or a metadata CSV.

Two layouts are supported:

1. *Directory layout* (default)::

       data/raw/<class_name>/<image>.jpg

   Class names are the sub-directory names, sorted alphabetically.

2. *Metadata CSV* with at least ``image_path`` and ``class_name`` columns and
   optional ``sample_id``, ``batch_id``, ``source``, ``capture_device``. The
   optional columns enable *grouped* splitting so that several photographs of
   the same physical cotton specimen never straddle train/val/test.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"})
GROUP_COLUMNS: tuple[str, ...] = ("sample_id", "batch_id", "source")


@dataclass(frozen=True)
class ImageRecord:
    """A single labelled image plus optional provenance metadata."""

    image_path: str
    class_name: str
    sample_id: str | None = None
    batch_id: str | None = None
    source: str | None = None
    capture_device: str | None = None

    def group_value(self, key: str) -> str | None:
        return getattr(self, key, None)

    def to_row(self) -> dict[str, str]:
        return {k: ("" if v is None else str(v)) for k, v in asdict(self).items()}


@dataclass
class DatasetIndex:
    """All discovered records plus derived class information."""

    root: Path
    records: list[ImageRecord]
    class_names: list[str] = field(default_factory=list)
    invalid_files: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.class_names:
            self.class_names = sorted({r.class_name for r in self.records})

    @property
    def class_to_index(self) -> dict[str, int]:
        return {c: i for i, c in enumerate(self.class_names)}

    @property
    def num_classes(self) -> int:
        return len(self.class_names)

    def counts_per_class(self) -> dict[str, int]:
        counts = {c: 0 for c in self.class_names}
        for r in self.records:
            counts[r.class_name] = counts.get(r.class_name, 0) + 1
        return counts

    def available_group_keys(self) -> list[str]:
        """Group columns that are populated for *every* record."""
        keys = []
        for key in GROUP_COLUMNS:
            if self.records and all(r.group_value(key) for r in self.records):
                keys.append(key)
        return keys

    def __len__(self) -> int:
        return len(self.records)


def _iter_image_files(class_dir: Path) -> Iterable[Path]:
    for p in sorted(class_dir.rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            yield p


def discover_from_directory(root: str | Path) -> DatasetIndex:
    """Discover ``root/<class>/<image>`` and return an index (classes sorted)."""
    root = Path(root)
    if not root.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {root}")

    class_dirs = sorted(d for d in root.iterdir() if d.is_dir() and not d.name.startswith("."))
    if not class_dirs:
        raise ValueError(f"No class sub-directories found in {root}. Expected {root}/<class_name>/<images>")

    records: list[ImageRecord] = []
    invalid: list[str] = []
    for class_dir in class_dirs:
        for file in _iter_image_files(class_dir):
            if file.suffix.lower() in SUPPORTED_EXTENSIONS:
                records.append(ImageRecord(image_path=str(file), class_name=class_dir.name))
            else:
                invalid.append(str(file))
    return DatasetIndex(root=root, records=records, class_names=[d.name for d in class_dirs], invalid_files=invalid)


def discover_from_csv(csv_path: str | Path, image_root: str | Path | None = None) -> DatasetIndex:
    """Read a metadata CSV. Relative ``image_path`` values are resolved against ``image_root``."""
    csv_path = Path(csv_path)
    if not csv_path.is_file():
        raise FileNotFoundError(f"Metadata CSV not found: {csv_path}")
    base = Path(image_root) if image_root else csv_path.parent

    records: list[ImageRecord] = []
    invalid: list[str] = []
    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"image_path", "class_name"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"CSV must contain columns {sorted(required)}; found {reader.fieldnames}")
        for row in reader:
            raw_path = Path(row["image_path"].strip())
            path = raw_path if raw_path.is_absolute() else base / raw_path
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                invalid.append(str(path))
                continue
            records.append(
                ImageRecord(
                    image_path=str(path),
                    class_name=row["class_name"].strip(),
                    sample_id=(row.get("sample_id") or "").strip() or None,
                    batch_id=(row.get("batch_id") or "").strip() or None,
                    source=(row.get("source") or "").strip() or None,
                    capture_device=(row.get("capture_device") or "").strip() or None,
                )
            )
    return DatasetIndex(root=base, records=records, invalid_files=invalid)


def discover_dataset(root: str | Path, metadata_csv: str | Path | None = None) -> DatasetIndex:
    """Entry point used by audit/split/train: CSV when provided, else directory layout."""
    if metadata_csv:
        return discover_from_csv(metadata_csv, image_root=root)
    return discover_from_directory(root)


def write_records_csv(records: Iterable[ImageRecord], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["image_path", "class_name", "sample_id", "batch_id", "source", "capture_device"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow(r.to_row())


def read_records_csv(path: str | Path) -> list[ImageRecord]:
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    return [
        ImageRecord(
            image_path=r["image_path"],
            class_name=r["class_name"],
            sample_id=r.get("sample_id") or None,
            batch_id=r.get("batch_id") or None,
            source=r.get("source") or None,
            capture_device=r.get("capture_device") or None,
        )
        for r in rows
    ]

"""Reproducible stratified / grouped train-val-test splitting.

Why grouped splitting matters
-----------------------------
If 20 photographs are taken of the same physical cotton specimen and they are
randomly scattered across train and test, the test score measures *memorisation
of that specimen*, not generalisation to unseen cotton. When a group column is
available (``sample_id`` > ``batch_id`` > ``source``) all images sharing a group
value are kept in the same split.

CRITICAL ACADEMIC INTEGRITY WARNING
-----------------------------------
Folder-only datasets (e.g. ``data/raw/<variety>/<image>.jpg``) CANNOT guarantee
specimen-level leakage prevention. If multiple photos were captured of the same
cotton boll or fibre sample under different lighting, angles, or focal lengths,
standard stratified splitting will disperse identical physical samples across
train, val, and test splits. For scientifically valid grouped evaluation,
a metadata CSV with ``sample_id`` is strictly required.
"""

from __future__ import annotations

import json
import logging
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.model_selection import GroupShuffleSplit, train_test_split

from ml.data.discovery import DatasetIndex, ImageRecord, read_records_csv, write_records_csv

logger = logging.getLogger("ml.splits")


@dataclass
class SplitResult:
    train: list[ImageRecord]
    val: list[ImageRecord]
    test: list[ImageRecord]
    class_names: list[str]
    group_key: str | None
    seed: int

    def summary(self) -> dict:
        def per_class(recs: list[ImageRecord]) -> dict[str, int]:
            out = {c: 0 for c in self.class_names}
            for r in recs:
                out[r.class_name] += 1
            return out

        return {
            "seed": self.seed,
            "group_key": self.group_key,
            "class_names": self.class_names,
            "sizes": {"train": len(self.train), "val": len(self.val), "test": len(self.test)},
            "per_class": {"train": per_class(self.train), "val": per_class(self.val), "test": per_class(self.test)},
            "specimen_leakage_prevented": self.group_key is not None,
            "specimen_leakage_risk": "NONE (GROUPED SPLIT)" if self.group_key is not None else "HIGH - FOLDER ONLY DATASET",
            "guidance": "sample_id required for guaranteed specimen-level isolation",
            "specimen_leakage_warning": (
                None
                if self.group_key is not None
                else "FOLDER-ONLY WARNING: Folder-based datasets cannot guarantee specimen-level leakage prevention. For scientifically valid evaluation, metadata with sample_id is required."
            ),
        }



    def check_no_group_leakage(self) -> bool:
        """True when no group value appears in more than one split (or no group key)."""
        if not self.group_key:
            return True
        key = self.group_key
        sets = [
            {r.group_value(key) for r in self.train},
            {r.group_value(key) for r in self.val},
            {r.group_value(key) for r in self.test},
        ]
        return not (sets[0] & sets[1] or sets[0] & sets[2] or sets[1] & sets[2])


def resolve_group_key(index: DatasetIndex, group_by: str) -> str | None:
    """Map the config value (auto/none/<column>) to an actual populated column or None."""
    available = index.available_group_keys()
    if group_by == "none":
        return None
    if group_by == "auto":
        return available[0] if available else None
    if group_by not in available:
        raise ValueError(
            f"group_by='{group_by}' requested but that column is not populated for every record. "
            f"Populated group columns: {available or 'none'}"
        )
    return group_by


def _stratified(records: list[ImageRecord], ratios: tuple[float, float, float], seed: int) -> SplitResult:
    labels = [r.class_name for r in records]
    train_ratio, val_ratio, test_ratio = ratios
    holdout = val_ratio + test_ratio
    train, rest = train_test_split(records, test_size=holdout, stratify=labels, random_state=seed)
    if test_ratio == 0:
        val, test = rest, []
    elif val_ratio == 0:
        val, test = [], rest
    else:
        rest_labels = [r.class_name for r in rest]
        val, test = train_test_split(
            rest, test_size=test_ratio / holdout, stratify=rest_labels, random_state=seed
        )
    return SplitResult(list(train), list(val), list(test), [], None, seed)


def _grouped(
    records: list[ImageRecord], ratios: tuple[float, float, float], seed: int, key: str
) -> SplitResult:
    groups = np.array([r.group_value(key) for r in records])
    idx = np.arange(len(records))
    train_ratio, val_ratio, test_ratio = ratios
    holdout = val_ratio + test_ratio
    gss = GroupShuffleSplit(n_splits=1, test_size=holdout, random_state=seed)
    train_idx, rest_idx = next(gss.split(idx, groups=groups))
    if test_ratio == 0 or val_ratio == 0:
        val_idx, test_idx = (rest_idx, np.array([], dtype=int)) if test_ratio == 0 else (np.array([], dtype=int), rest_idx)
    else:
        gss2 = GroupShuffleSplit(n_splits=1, test_size=test_ratio / holdout, random_state=seed)
        v, t = next(gss2.split(rest_idx, groups=groups[rest_idx]))
        val_idx, test_idx = rest_idx[v], rest_idx[t]
    pick = lambda ids: [records[i] for i in sorted(ids)]  # noqa: E731
    return SplitResult(pick(train_idx), pick(val_idx), pick(test_idx), [], key, seed)


def create_splits(
    index: DatasetIndex,
    ratios: tuple[float, float, float] = (0.7, 0.15, 0.15),
    seed: int = 42,
    group_by: str = "auto",
) -> SplitResult:
    """Split an index deterministically. Uses grouped splitting when a group key resolves."""
    if abs(sum(ratios) - 1.0) > 1e-6:
        raise ValueError("ratios must sum to 1")
    counts = index.counts_per_class()
    too_small = [c for c, n in counts.items() if n < 3]
    if too_small:
        raise ValueError(f"Every class needs >= 3 images to split; too small: {too_small}")

    key = resolve_group_key(index, group_by)
    if key is None:
        logger.warning(
            "FOLDER-ONLY SPLIT WARNING: No group key available. Using stratified split. "
            "Specimen-level leakage cannot be mathematically prevented without sample_id metadata."
        )
    result = _grouped(index.records, ratios, seed, key) if key else _stratified(index.records, ratios, seed)
    result.class_names = list(index.class_names)
    if not result.check_no_group_leakage():
        raise RuntimeError(
            f"CRITICAL: Specimen group leakage detected across splits for group key '{key}'. "
            "A specimen appears in more than one partition."
        )
    return result



def save_splits(result: SplitResult, out_dir: str | Path) -> Path:
    """Write train/val/test CSVs, class_map.json and split_summary.json."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    write_records_csv(result.train, out / "train.csv")
    write_records_csv(result.val, out / "val.csv")
    write_records_csv(result.test, out / "test.csv")
    with open(out / "class_map.json", "w", encoding="utf-8") as fh:
        json.dump({"class_names": result.class_names}, fh, indent=2)
    with open(out / "split_summary.json", "w", encoding="utf-8") as fh:
        json.dump({**result.summary(), "no_group_leakage": result.check_no_group_leakage()}, fh, indent=2)
    return out


def load_splits(splits_dir: str | Path) -> SplitResult:
    d = Path(splits_dir)
    with open(d / "class_map.json", encoding="utf-8") as fh:
        class_names = json.load(fh)["class_names"]
    summary_path = d / "split_summary.json"
    group_key, seed = None, 0
    if summary_path.exists():
        with open(summary_path, encoding="utf-8") as fh:
            s = json.load(fh)
            group_key, seed = s.get("group_key"), s.get("seed", 0)
    return SplitResult(
        read_records_csv(d / "train.csv"),
        read_records_csv(d / "val.csv"),
        read_records_csv(d / "test.csv"),
        class_names,
        group_key,
        seed,
    )

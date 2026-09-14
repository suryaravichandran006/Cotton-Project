"""Create reproducible splits: ``python -m ml.split_dataset --config config/train.yaml``."""

from __future__ import annotations

import argparse
import json
import sys

from ml.config import load_train_config
from ml.data.discovery import discover_dataset
from ml.data.splits import create_splits, save_splits


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create stratified/grouped train-val-test splits")
    parser.add_argument("--config", default="config/train.yaml")
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--metadata-csv", default=None)
    parser.add_argument("--splits-dir", default=None)
    parser.add_argument("--group-by", default=None, help="auto | none | sample_id | batch_id | source")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args(argv)

    cfg = load_train_config(
        args.config,
        {"data_dir": args.data_dir, "metadata_csv": args.metadata_csv, "splits_dir": args.splits_dir, "group_by": args.group_by, "seed": args.seed},
    )
    index = discover_dataset(cfg.data_path, cfg.metadata_csv)
    result = create_splits(index, (cfg.train_ratio, cfg.val_ratio, cfg.test_ratio), cfg.seed, cfg.group_by)
    out = save_splits(result, cfg.splits_path)
    print(json.dumps({**result.summary(), "no_group_leakage": result.check_no_group_leakage(), "output_dir": str(out)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

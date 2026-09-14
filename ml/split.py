"""CLI entrypoint alias for dataset splitting: ``python -m ml.split``."""

from __future__ import annotations

import sys

from ml.split_dataset import main

if __name__ == "__main__":
    sys.exit(main())

"""CLI entrypoint alias for dataset audit: ``python -m ml.audit``."""

from __future__ import annotations

import sys

from ml.audit_dataset import main

if __name__ == "__main__":
    sys.exit(main())

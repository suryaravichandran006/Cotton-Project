"""Small shared helpers (paths, seeding, device selection, JSON I/O)."""

from ml.utils.paths import REPO_ROOT, resolve_path
from ml.utils.seed import seed_everything

__all__ = ["REPO_ROOT", "resolve_path", "seed_everything"]

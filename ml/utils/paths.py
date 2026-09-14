"""Repository-relative path handling (platform independent)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT: Path = Path(__file__).resolve().parents[2]
CONFIG_DIR: Path = REPO_ROOT / "config"
MODELS_DIR: Path = REPO_ROOT / "models"
DEFAULT_REGISTRY_PATH: Path = MODELS_DIR / "registry.json"


def resolve_path(path: str | Path, base: Path | None = None) -> Path:
    """Resolve ``path`` against ``base`` (default: repository root) unless absolute."""
    p = Path(path).expanduser()
    if p.is_absolute():
        return p
    return (base or REPO_ROOT) / p


def read_json(path: str | Path) -> Any:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: str | Path, payload: Any, indent: int = 2) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=indent, default=_json_default)
        fh.write("\n")


def _json_default(obj: Any) -> Any:
    """Make numpy / pathlib objects JSON serialisable."""
    if isinstance(obj, Path):
        return str(obj)
    if hasattr(obj, "tolist"):
        return obj.tolist()
    if hasattr(obj, "item"):
        return obj.item()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serialisable")


def git_commit_hash() -> str | None:
    """Return the current git commit hash if the repo is a git checkout."""
    import subprocess

    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return out.stdout.strip() or None if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None

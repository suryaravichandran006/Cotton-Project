"""Device selection: CUDA -> Apple MPS -> CPU, with an explicit override."""

from __future__ import annotations


def select_device(preferred: str | None = "auto") -> str:
    """Return a torch device string.

    ``preferred`` may be ``auto``, ``cuda``, ``mps`` or ``cpu``. Unavailable
    devices silently fall back to CPU so the same config works on a laptop,
    Colab and a Mac.
    """
    import torch

    pref = (preferred or "auto").lower()
    if pref == "cpu":
        return "cpu"
    if pref in ("auto", "cuda") and torch.cuda.is_available():
        return "cuda"
    mps_ok = getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available()
    if pref in ("auto", "mps") and mps_ok:
        return "mps"
    return "cpu"


def amp_enabled(device: str, requested: bool) -> bool:
    """Mixed precision is only enabled on CUDA (MPS/CPU autocast is unreliable)."""
    return bool(requested and device == "cuda")

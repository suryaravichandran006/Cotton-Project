"""Shared fixtures. Environment is configured *before* the backend is imported."""

from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path

import pytest
from PIL import Image

_TMP = Path(tempfile.mkdtemp(prefix="cottonvision-tests-"))
os.environ.update(
    {
        "APP_ENV": "test",
        "MODEL_MODE": "mock",
        "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
        "UPLOAD_DIR": str(_TMP / "uploads"),
        "GRADCAM_DIR": str(_TMP / "gradcam"),
        "MAX_UPLOAD_MB": "0.5",
        "LOG_LEVEL": "WARNING",
        "WARM_MODEL_ON_STARTUP": "false",
    }
)


def make_image_bytes(fmt: str = "PNG", size: tuple[int, int] = (160, 120), seed: int = 1) -> bytes:
    import numpy as np

    rng = np.random.default_rng(seed)
    arr = (rng.random((size[1], size[0], 3)) * 255).astype("uint8")
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(scope="session")
def png_bytes() -> bytes:
    return make_image_bytes("PNG")


@pytest.fixture(scope="session")
def jpeg_bytes() -> bytes:
    return make_image_bytes("JPEG", seed=2)


@pytest.fixture
def tiny_dataset(tmp_path: Path) -> Path:
    """3 classes x 6 images, one exact duplicate, one invalid extension."""
    import numpy as np

    root = tmp_path / "raw"
    for c, cls in enumerate(["Variety_A", "Variety_B", "Variety_C"]):
        d = root / cls
        d.mkdir(parents=True)
        for i in range(6):
            rng = np.random.default_rng(c * 100 + i)
            Image.fromarray((rng.random((96, 128, 3)) * 255).astype("uint8")).save(d / f"img_{i}.png")
    (root / "Variety_A" / "dup.png").write_bytes((root / "Variety_A" / "img_0.png").read_bytes())
    (root / "Variety_B" / "notes.txt").write_text("not an image")
    return root

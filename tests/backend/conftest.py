from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _build_client(**env: str) -> TestClient:
    from backend.app import database
    from backend.app.config import get_settings
    from backend.app.main import create_app

    old = {k: os.environ.get(k) for k in env}
    os.environ.update(env)
    get_settings.cache_clear()
    database.reset_engine()
    app = create_app(get_settings())
    client = TestClient(app)
    client.__enter__()
    client._cv_restore = old  # type: ignore[attr-defined]
    return client


def _teardown(client: TestClient) -> None:
    from backend.app import database
    from backend.app.config import get_settings

    client.__exit__(None, None, None)
    for k, v in getattr(client, "_cv_restore", {}).items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    get_settings.cache_clear()
    database.reset_engine()


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    c = _build_client()
    yield c
    _teardown(c)


@pytest.fixture
def fresh_client(tmp_path: Path) -> Iterator[TestClient]:
    c = _build_client(DATABASE_URL=f"sqlite:///{(tmp_path / 'fresh.db').as_posix()}", UPLOAD_DIR=str(tmp_path / "u"), GRADCAM_DIR=str(tmp_path / "g"))
    yield c
    _teardown(c)


@pytest.fixture
def trained_mode_without_model(tmp_path: Path) -> Iterator[TestClient]:
    registry = tmp_path / "registry.json"
    registry.write_text('{"schema_version": 1, "active_model": null, "models": []}')
    c = _build_client(MODEL_MODE="trained", MODEL_REGISTRY_PATH=str(registry), DATABASE_URL=f"sqlite:///{(tmp_path / 't.db').as_posix()}")
    yield c
    _teardown(c)

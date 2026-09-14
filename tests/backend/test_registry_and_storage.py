from __future__ import annotations

from pathlib import Path

import pytest

from backend.app.config import Settings
from backend.app.services.storage import LocalStorage, secure_filename
from backend.app.services.varieties import VarietyCatalog, normalize_key
from ml.registry import ModelEntry, ModelRegistry


def test_registry_roundtrip(tmp_path: Path):
    path = tmp_path / "registry.json"
    reg = ModelRegistry(path)
    assert reg.active_model is None and reg.models == []
    entry = ModelEntry(
        name="m1", version="1.0.0", architecture="convnext_tiny", checkpoint="models/exports/m1/model.pt", class_names=["A", "B"], calibration_temperature=1.3
    )
    reg.add(entry)
    reg.set_active("m1")
    reg.save()

    loaded = ModelRegistry(path)
    assert loaded.active_model == "m1" and loaded.active_entry().calibration_temperature == 1.3
    with pytest.raises(ValueError):
        loaded.add(entry)
    with pytest.raises(KeyError):
        loaded.set_active("missing")
    loaded.remove("m1")
    assert loaded.active_model is None


def test_secure_filename_whitelists_extension():
    assert secure_filename("JPEG").endswith(".jpg")
    assert secure_filename("../evil").endswith(".bin")
    assert secure_filename("png") != secure_filename("png")


def test_local_storage_rejects_traversal(tmp_path: Path):
    settings = Settings(upload_dir=str(tmp_path / "u"), gradcam_dir=str(tmp_path / "g"))
    storage = LocalStorage(settings)
    stored = storage.save(b"abc", "uploads", "png")
    assert storage.exists(stored.key) and stored.key.startswith("uploads/")
    assert storage.public_url(stored.key, "http://api.local/") == f"http://api.local/files/{stored.key}"
    assert storage.delete("uploads/../../etc/passwd") is False
    assert storage.exists("other/x.png") is False
    assert storage.delete(stored.key) is True and not storage.exists(stored.key)


def test_variety_catalog_matching(tmp_path: Path):
    yaml_file = tmp_path / "v.yaml"
    yaml_file.write_text("varieties:\n  - class_name: Giza_86\n    display_name: Giza 86\n    demo_placeholder: true\n")
    cat = VarietyCatalog(yaml_file)
    assert normalize_key("Giza 86") == normalize_key("giza_86") == normalize_key("GIZA-86")
    assert cat.display_name("giza-86") == "Giza 86"
    unknown = cat.describe("Shankar_6")
    assert unknown.has_info is False and unknown.display_name == "Shankar 6"

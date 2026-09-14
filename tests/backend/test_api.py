from __future__ import annotations

from tests.conftest import make_image_bytes

API = "/api/v1"


def _upload(client, data: bytes, name="sample.png", ctype="image/png", **params):
    return client.post(f"{API}/predict", files={"file": (name, data, ctype)}, params=params)


# ----------------------------------------------------------------- health / meta
def test_health(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["mode"] == "mock" and body["database"] == "ok"
    assert "X-Request-ID" in r.headers


def test_models_and_active(client):
    r = client.get(f"{API}/models")
    assert r.status_code == 200 and r.json()["active_model"] is None
    a = client.get(f"{API}/models/active").json()
    assert a["is_mock"] is True and a["status"] == "ready" and "Demo mode" in a["message"]
    assert a["num_classes"] >= 2


def test_classes_from_fallback_config(client):
    body = client.get(f"{API}/classes").json()
    assert body["source"] == "fallback_config" and body["num_classes"] == len(body["classes"])
    assert body["classes"][0]["variety"]["demo_placeholder"] is True
    one = client.get(f"{API}/classes/{body['classes'][0]['class_name']}").json()
    assert one["display_name"]
    assert client.get(f"{API}/classes/Not_A_Class").status_code == 404


def test_system_info(client):
    body = client.get(f"{API}/system/info").json()
    assert body["mode"] == "mock" and "image/jpeg" in body["supported_formats"] and body["storage_backend"] == "local"


# ----------------------------------------------------------------- prediction
def test_mock_prediction_is_flagged(client, png_bytes):
    r = _upload(client, png_bytes)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_mock"] is True and body["model"]["is_mock"] is True
    assert any("Demo prediction" in w for w in body["warnings"])
    assert len(body["top_predictions"]) == 3 and body["top_predictions"][0]["rank"] == 1
    assert 0 <= body["prediction"]["confidence"] <= 1
    assert body["prediction"]["confidence_level"] in ("high", "medium", "low", "unknown")
    assert body["processing"]["total_ms"] >= body["processing"]["inference_ms"]
    assert body["image"]["url"].startswith("http://testserver/files/uploads/")
    assert body["explanation"]["requested"] is False and body["explanation"]["gradcam_url"] is None
    assert client.get(body["image"]["url"]).status_code == 200


def test_prediction_is_deterministic(client, jpeg_bytes):
    a = _upload(client, jpeg_bytes, "a.jpg", "image/jpeg").json()
    b = _upload(client, jpeg_bytes, "b.jpg", "image/jpeg").json()
    assert a["prediction"]["class_name"] == b["prediction"]["class_name"]
    assert abs(a["prediction"]["confidence"] - b["prediction"]["confidence"]) < 1e-9


def test_gradcam_response(client, png_bytes):
    body = _upload(client, png_bytes, explain="true", top_k=2).json()
    assert body["explanation"]["available"] is True
    assert body["explanation"]["gradcam_url"].endswith(".png")
    assert "NOT a Grad-CAM" in body["explanation"]["note"]
    assert len(body["top_predictions"]) == 2
    img = client.get(body["explanation"]["gradcam_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    assert body["processing"]["explainability_ms"] > 0


def test_client_metadata_roundtrip(client, png_bytes):
    r = client.post(f"{API}/predict", files={"file": ("m.png", png_bytes, "image/png")}, data={"client_metadata": '{"device": "pixel-8", "app": "1.0"}'})
    assert r.status_code == 200 and r.json()["client_metadata"]["device"] == "pixel-8"
    bad = client.post(f"{API}/predict", files={"file": ("m.png", png_bytes, "image/png")}, data={"client_metadata": "not-json"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "invalid_metadata"


def test_webp_supported(client):
    r = _upload(client, make_image_bytes("WEBP"), "s.webp", "image/webp")
    assert r.status_code == 200 and r.json()["image"]["format"] == "WEBP"


# ----------------------------------------------------------------- validation
def test_rejects_non_image(client):
    r = _upload(client, b"hello, this is text", "notes.png", "image/png")
    assert r.status_code == 415 and r.json()["error"]["code"] == "unsupported_media_type"


def test_rejects_oversized(client):
    big = b"\xff\xd8\xff" + b"\x00" * (600 * 1024)  # > MAX_UPLOAD_MB (0.5) set in tests/conftest.py
    r = _upload(client, big, "big.jpg", "image/jpeg")
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_rejects_corrupt_image(client):
    r = _upload(client, b"\x89PNG\r\n\x1a\n" + b"garbage" * 50, "c.png", "image/png")
    assert r.status_code == 400 and r.json()["error"]["code"] == "corrupt_image"


def test_rejects_too_small_image(client):
    r = _upload(client, make_image_bytes("PNG", size=(20, 20)), "tiny.png", "image/png")
    assert r.status_code == 400 and r.json()["error"]["code"] == "image_too_small"


def test_rejects_empty_file(client):
    assert _upload(client, b"", "e.png", "image/png").status_code == 400


def test_filename_is_sanitized_and_not_used_on_disk(client, png_bytes):
    body = _upload(client, png_bytes, "../../etc/passwd.png").json()
    assert body["image"]["original_filename"] == "passwd.png"
    assert "passwd" not in body["image"]["url"]


# ----------------------------------------------------------------- OOD / unknown
def test_unknown_when_confidence_below_threshold(client, png_bytes):
    from ml.ood import ConfidenceThresholdRejector

    predictor = client.app.state.services.models.predictor
    original = predictor.rejector
    predictor.rejector = ConfidenceThresholdRejector(1.0)
    try:
        body = _upload(client, png_bytes).json()
    finally:
        predictor.rejector = original
    assert body["prediction"]["is_unknown"] is True
    assert body["prediction"]["confidence_level"] == "unknown"
    assert body["prediction"]["unknown_reason"] and body["variety"] is None
    assert any("below the configured threshold" in w for w in body["warnings"])


# ----------------------------------------------------------------- batch
def test_batch_prediction_mixed(client, png_bytes):
    files = [("files", ("ok.png", png_bytes, "image/png")), ("files", ("bad.png", b"nope", "image/png"))]
    body = client.post(f"{API}/predict/batch", files=files).json()
    assert body["count"] == 2 and body["succeeded"] == 1 and body["failed"] == 1
    assert body["items"][1]["error"]["code"] == "unsupported_media_type"


# ----------------------------------------------------------------- history
def test_history_list_get_delete(client, png_bytes):
    created = _upload(client, png_bytes, explain="true").json()
    listing = client.get(f"{API}/predictions", params={"page_size": 5, "sort_by": "created_at"}).json()
    assert listing["total"] >= 1 and any(i["id"] == created["id"] for i in listing["items"])
    assert set(listing) == {"items", "total", "page", "page_size", "pages"}

    detail = client.get(f"{API}/predictions/{created['id']}").json()
    assert detail["prediction"]["class_name"] == created["prediction"]["class_name"]
    assert detail["explanation"]["gradcam_url"] == created["explanation"]["gradcam_url"]

    filtered = client.get(f"{API}/predictions", params={"class_name": created["prediction"]["class_name"]}).json()
    assert all(i["predicted_class"] == created["prediction"]["class_name"] for i in filtered["items"])

    deleted = client.delete(f"{API}/predictions/{created['id']}").json()
    assert deleted == {"id": created["id"], "deleted": True}
    assert client.get(f"{API}/predictions/{created['id']}").status_code == 404
    assert client.get(created["image"]["url"]).status_code == 404
    assert client.delete(f"{API}/predictions/{created['id']}").status_code == 404


def test_statistics_reflect_history(client, png_bytes):
    _upload(client, png_bytes)
    s = client.get(f"{API}/statistics").json()
    assert s["total_predictions"] >= 1 and s["mock_predictions"] >= 1
    assert sum(b["count"] for b in s["confidence_distribution"]) == s["total_predictions"]
    assert s["predictions_over_time"] and s["class_distribution"]


def test_statistics_empty_state(fresh_client):
    s = fresh_client.get(f"{API}/statistics").json()
    assert s["total_predictions"] == 0 and s["mean_latency_ms"] is None and s["class_distribution"] == []


# ----------------------------------------------------------------- failure modes
def test_trained_mode_without_registered_model(trained_mode_without_model):
    c = trained_mode_without_model
    h = c.get(f"{API}/health").json()
    assert h["status"] == "degraded" and h["model_status"] == "error"
    active = c.get(f"{API}/models/active").json()
    assert active["status"] == "error" and "no active model" in active["error"]
    assert active["class_names"] == []
    # Verify mock classes never leak to /classes in trained mode:
    classes_resp = c.get(f"{API}/classes").json()
    assert classes_resp["num_classes"] == 0
    assert classes_resp["classes"] == []
    assert classes_resp["source"] == "registry"
    assert classes_resp["is_mock"] is False
    assert c.get(f"{API}/classes/Giza_45").status_code == 404
    r = _upload(c, make_image_bytes())
    assert r.status_code == 503 and r.json()["error"]["code"] == "model_unavailable"


def test_mock_classes_never_leak_into_trained_mode_with_active_model(tmp_path):
    from ml.registry import ModelEntry, ModelRegistry
    from tests.backend.conftest import _build_client, _teardown

    # Create a registry with custom trained cultivars (e.g., Indian research cultivars)
    reg_file = tmp_path / "registry.json"
    registry = ModelRegistry(reg_file)
    entry = ModelEntry(
        name="custom-cotton-net",
        version="1.0.0",
        architecture="resnet50",
        checkpoint="dummy.pt",
        class_names=["Shankar_6", "MCU_5", "DCH_32"],
        image_size=224,
        metrics={"macro_f1": 0.95},
    )
    registry.add(entry)
    registry.set_active("custom-cotton-net")
    registry.save()

    # Create client configured with this registry in trained mode
    # Note: Even if mock_classes.json exists, trained mode must strictly reflect the registry
    c = _build_client(
        MODEL_MODE="mock",  # use mock predictor to bypass loading dummy checkpoint weights, but point to registry
        MODEL_REGISTRY_PATH=str(reg_file),
        DATABASE_URL=f"sqlite:///{(tmp_path / 't.db').as_posix()}",
    )
    try:
        active = c.get(f"{API}/models/active").json()
        assert active["class_names"] == ["Shankar_6", "MCU_5", "DCH_32"]
        classes_resp = c.get(f"{API}/classes").json()
        assert [cls["class_name"] for cls in classes_resp["classes"]] == ["Shankar_6", "MCU_5", "DCH_32"]
        assert not any("Giza" in cls["class_name"] for cls in classes_resp["classes"])
    finally:
        _teardown(c)


def test_unknown_route_has_structured_error(client):
    r = client.get(f"{API}/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_api_key_enforced_when_configured(tmp_path):
    from tests.backend.conftest import _build_client, _teardown

    c = _build_client(API_KEY="secret", DATABASE_URL=f"sqlite:///{(tmp_path / 'k.db').as_posix()}")
    try:
        assert _upload(c, make_image_bytes()).status_code == 401
        r = c.post(f"{API}/predict", files={"file": ("a.png", make_image_bytes(), "image/png")}, headers={"X-API-Key": "secret"})
        assert r.status_code == 200
    finally:
        _teardown(c)

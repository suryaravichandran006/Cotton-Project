# API reference

Base URL (development): `http://localhost:8000/api/v1`
Interactive documentation: `http://localhost:8000/docs` (Swagger UI) and `/redoc`; raw schema at `/openapi.json`.

All responses are JSON. Every response carries `X-Request-ID` and `X-Process-Time-Ms` headers.
When the backend runs with `MODEL_MODE=mock`, prediction responses contain `"is_mock": true` — clients **must** surface this.

## Error envelope

Every error uses the same shape:

```json
{ "error": { "code": "file_too_large", "message": "Image exceeds the maximum upload size of 10 MB", "details": { "max_upload_mb": 10 } },
  "request_id": "3f2c1a9b0e7d" }
```

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `empty_file`, `corrupt_image`, `image_too_small`, `invalid_metadata`, `empty_batch`, `batch_too_large` | bad input |
| 401 | `unauthorized` | `API_KEY` configured and `X-API-Key` missing/wrong |
| 404 | `not_found` | unknown prediction / class / route |
| 413 | `file_too_large`, `image_too_large` | over `MAX_UPLOAD_MB` or pixel/dimension limits |
| 415 | `unsupported_media_type` | not JPEG/PNG/WEBP (checked by magic bytes, not extension) |
| 422 | `validation_error` | malformed query/form parameters |
| 429 | `rate_limited` | `RATE_LIMIT_PER_MINUTE` exceeded |
| 500 | `inference_failed`, `database_error`, `internal_error` | server-side failure (details in logs, keyed by `request_id`) |
| 503 | `model_unavailable` | no model loaded (e.g. `MODEL_MODE=trained` with an empty registry) |
| 504 | `inference_timeout` | exceeded `INFERENCE_TIMEOUT_S` |

---

## `GET /health`

```json
{ "status": "ok", "app": "Cotton Grade API", "version": "0.1.0", "environment": "development",
  "mode": "mock", "model_status": "ready", "database": "ok", "timestamp": "2025-01-01T10:00:00Z" }
```
`status` is `degraded` when the database or the model is not ready.

## `GET /models`

Registry contents: `registry_path`, `active_model`, `mode`, and `models[]` (name, version, architecture, checkpoint,
class_names, image_size, calibration_temperature, ood, metrics, trained_at, registered_at, git_commit, description, size_mb,
is_active, checkpoint_exists).

## `GET /models/active`

What is being served right now:

```json
{ "mode": "mock", "status": "ready", "is_mock": true,
  "model_name": "mock-demo-predictor", "model_version": "0.0.0-mock", "architecture": "none (mock)",
  "device": "cpu", "num_classes": 5, "class_names": ["Giza_86", "Giza_87", "Giza_90", "Giza_94", "Giza_96"],
  "image_size": 224, "calibration_temperature": 1.0,
  "ood": { "name": "confidence_threshold", "threshold": 0.6 },
  "registry_entry": null, "error": null,
  "message": "Demo mode — trained model not loaded. Predictions are deterministic placeholders." }
```
`status` is `error` (with `error` text) when a trained model failed to load.

## `GET /classes` · `GET /classes/{class_name}`

Classes the active model can predict (`source` is `registry` for a trained model, `fallback_config` in mock mode) with optional
variety information from `config/varieties.yaml` (`demo_placeholder: true` marks unverified placeholder entries).

## `POST /predict`

`multipart/form-data`

| Part / param | Type | Description |
| --- | --- | --- |
| `file` | file | JPEG / PNG / WEBP, ≤ `MAX_UPLOAD_MB` (default 10), 64–8000 px per side |
| `explain` | query bool | generate a Grad-CAM heatmap (default `false`; adds latency) |
| `top_k` | query int 1–10 | ranked classes to return (default 3) |
| `client_metadata` | form string | optional JSON object (device, app version, location label …) stored with the record |

Response `200`:

```json
{
  "id": "5d7a0f0c0b1e4d6f9a3c2b1a0f9e8d7c",
  "status": "success",
  "is_mock": true,
  "created_at": "2025-01-01T10:00:00.123456Z",
  "model": { "name": "mock-demo-predictor", "version": "0.0.0-mock", "architecture": "none (mock)", "device": "cpu", "is_mock": true },
  "prediction": {
    "class_name": "Giza_96", "display_name": "Giza 96",
    "confidence": 0.842, "raw_probability": 0.842,
    "confidence_level": "medium", "is_unknown": false, "unknown_reason": null
  },
  "top_predictions": [
    { "rank": 1, "class_name": "Giza_96", "display_name": "Giza 96", "calibrated_confidence": 0.842, "raw_probability": 0.842 },
    { "rank": 2, "class_name": "Giza_86", "display_name": "Giza 86", "calibrated_confidence": 0.091, "raw_probability": 0.091 },
    { "rank": 3, "class_name": "Giza_90", "display_name": "Giza 90", "calibrated_confidence": 0.040, "raw_probability": 0.040 }
  ],
  "explanation": { "requested": true, "available": true, "gradcam_url": "http://localhost:8000/files/gradcam/9f…png", "error": null,
                   "note": "Demonstration heatmap derived from image texture. It is NOT a Grad-CAM explanation of a trained model." },
  "processing": { "preprocess_ms": 6.1, "inference_ms": 0.4, "explainability_ms": 5.8, "total_ms": 12.6, "device": "cpu" },
  "image": { "url": "http://localhost:8000/files/uploads/3a…png", "original_filename": "cotton.png", "width": 512, "height": 512, "size_bytes": 20481, "format": "PNG" },
  "variety": { "class_name": "Giza_96", "display_name": "Giza 96", "scientific_name": "Gossypium barbadense", "designation": "…", "region": "…", "staple_category": "Extra Long Staple", "staple_length_mm": 35.0, "micronaire": 3.8, "strength_g_tex": 46.2, "description": "…", "source": "CRI Technical Bulletin", "characteristics": [], "notes": "…", "demo_placeholder": true, "has_info": true },
  "ood": { "strategy": "confidence_threshold", "scores": { "max_calibrated_confidence": 0.842, "threshold": 0.6 } },
  "warnings": ["Demo prediction — trained model not yet installed. …"],
  "client_metadata": { "client": "web" }
}
```

Semantics:

- `prediction.confidence` is the **calibrated** value (temperature-scaled softmax); `raw_probability` is the plain softmax.
- `confidence_level`: `high` (≥ 0.85) · `medium` (≥ 0.65) · `low` (above the unknown threshold) · `unknown` (rejected).
- When `is_unknown` is `true`, `variety` is `null` and `prediction.class_name` is only the *closest* class — do not present it as an identification.
- Image and heatmap URLs are absolute (built from the request host / `X-Forwarded-*` headers or `PUBLIC_BASE_URL`).

## `POST /predict/batch`

`files` (repeated multipart part, ≤ `MAX_BATCH_SIZE`, default 8), same `explain` / `top_k` query params.
Each item succeeds or fails independently:

```json
{ "count": 2, "succeeded": 1, "failed": 1,
  "items": [ { "index": 0, "filename": "a.jpg", "status": "success", "result": { …PredictionResponse… } },
             { "index": 1, "filename": "b.txt", "status": "error", "error": { "code": "unsupported_media_type", "message": "…" } } ] }
```

## `GET /predictions`

Query params: `page` (≥1), `page_size` (1–100, default 20), `sort_by` (`created_at` | `confidence` | `predicted_class` | `total_ms`),
`order` (`asc` | `desc`), `class_name`, `is_unknown`, `is_mock`, `model_name`, `min_confidence`, `search` (class or filename),
`date_from`, `date_to` (ISO 8601).

```json
{ "items": [ { "id": "…", "created_at": "…", "predicted_class": "Giza_96", "display_name": "Giza 96", "confidence": 0.84,
               "confidence_level": "medium", "is_unknown": false, "is_mock": true, "model_name": "mock-demo-predictor",
               "model_version": "0.0.0-mock", "total_ms": 12.6, "image_url": "…", "gradcam_url": "…" } ],
  "total": 1, "page": 1, "page_size": 20, "pages": 1 }
```

## `GET /predictions/{id}` · `DELETE /predictions/{id}`

Full `PredictionResponse` for a stored record; delete removes the row **and** its image/heatmap files → `{ "id": "…", "deleted": true }`.

## `GET /statistics`

Aggregates over stored predictions only (no simulation). Empty history yields zeros/nulls and empty arrays.

```json
{ "total_predictions": 12, "mock_predictions": 12, "real_predictions": 0, "unknown_count": 2, "unknown_percentage": 16.67,
  "mean_confidence": 0.71, "mean_latency_ms": 11.9, "mean_inference_ms": 0.5,
  "predictions_over_time": [ { "date": "2025-01-01", "count": 12, "unknown_count": 2 } ],
  "class_distribution": [ { "class_name": "Giza_96", "display_name": "Giza 96", "count": 5 }, { "class_name": "UNKNOWN", "display_name": "Unknown", "count": 2 } ],
  "confidence_distribution": [ { "bin_start": 0.0, "bin_end": 0.1, "count": 0 }, … ],
  "confidence_levels": { "high": 4, "medium": 3, "low": 3, "unknown": 2 },
  "models_used": { "mock-demo-predictor@0.0.0-mock": 12 },
  "first_prediction_at": "…", "last_prediction_at": "…" }
```

## `GET /system/info`

App/version/environment, Python and platform, `torch_version`, `cuda_available`, `mps_available`, active `device`, `mode`,
`model_status`, `max_upload_mb`, `supported_formats`, `database_backend`, `storage_backend`, `uptime_seconds`.

## Authentication & rate limiting (ready hooks)

- Set `API_KEY=<secret>` in `backend/.env` → `POST /predict*` and `DELETE /predictions/{id}` require header `X-API-Key: <secret>`.
  Unset (default) → no authentication. Replace `require_api_key` in `backend/app/dependencies.py` with JWT/OAuth later.
- Set `RATE_LIMIT_PER_MINUTE=60` → per-client-IP sliding window on prediction endpoints (in-memory; use Redis for multi-instance).

---

## Examples

### curl

```bash
API=http://localhost:8000/api/v1
curl -s $API/health | jq
curl -s $API/models/active | jq '.mode, .is_mock, .class_names'
curl -s -X POST "$API/predict?explain=true&top_k=3" -F "file=@data/samples/synthetic_sample_03.png" | jq '.prediction, .is_mock, .explanation.gradcam_url'
curl -s -X POST "$API/predict/batch" -F "files=@a.jpg" -F "files=@b.jpg" | jq '.succeeded, .failed'
curl -s "$API/predictions?page_size=5&sort_by=confidence&order=desc" | jq '.items[] | {display_name, confidence}'
curl -s -X DELETE $API/predictions/<id>
# with API key enabled:
curl -s -X POST "$API/predict" -H "X-API-Key: $API_KEY" -F "file=@cotton.jpg"
```

### JavaScript (browser / Node 18+)

```js
const API = "http://localhost:8000/api/v1";

export async function classify(file, { explain = true, topK = 3 } = {}) {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("client_metadata", JSON.stringify({ client: "web-example" }));
  const res = await fetch(`${API}/predict?explain=${explain}&top_k=${topK}`, { method: "POST", body: form });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(`${error.code}: ${error.message}`);
  }
  const result = await res.json();
  if (result.is_mock) console.warn("Demo prediction — trained model not yet installed.");
  return result;
}
```

### React Native (future mobile app)

```ts
const form = new FormData();
form.append("file", { uri: photo.uri, name: "cotton.jpg", type: "image/jpeg" } as unknown as Blob);
form.append("client_metadata", JSON.stringify({ device: Platform.OS, app: "1.0.0" }));
const res = await fetch("https://api.example.com/api/v1/predict?explain=true&top_k=3", { method: "POST", body: form });
const result = await res.json();
// result.prediction.display_name, result.prediction.confidence, result.prediction.is_unknown, result.explanation.gradcam_url
```

### Flutter (Dart)

```dart
final req = http.MultipartRequest('POST', Uri.parse('https://api.example.com/api/v1/predict?explain=true'))
  ..files.add(await http.MultipartFile.fromPath('file', imagePath, contentType: MediaType('image', 'jpeg')))
  ..fields['client_metadata'] = jsonEncode({'device': 'android', 'app': '1.0.0'});
final resp = await http.Response.fromStream(await req.send());
final json = jsonDecode(resp.body);
// json['prediction']['display_name'], json['is_mock']
```

Mobile checklist: send `multipart/form-data`; respect `MAX_UPLOAD_MB` (downscale on device to ~1500 px); display
`confidence_level` and the `is_unknown` state; show a demo warning when `is_mock` is `true`; image/heatmap URLs are absolute.
Image capture guidance for users is in the web app's Docs page and `docs/DATASET.md`.

# DEPLOYMENT.md

Cotton Grade deploys as two services — the **FastAPI backend** (Python, holds the model) and the **Next.js web client** — plus a
database and file storage. No specific paid provider is required; the options below are interchangeable.

## 1. Local (no Docker)

```bash
cp .env.example .env && cp backend/.env.example backend/.env
make install                     # backend deps + npm install
make migrate                     # alembic upgrade head (SQLite file under backend/storage/)
make dev                         # backend :8000 + frontend :3000
```

Production-like local run:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 1
npm run build && npm run start   # :3000
```

Use **one Uvicorn worker per model copy**: each worker loads the model into memory. Scale with more containers/instances rather than many workers.

## 2. Docker Compose

```bash
docker compose up --build                                        # mock mode, SQLite in a named volume
INSTALL_ML=true MODEL_MODE=trained docker compose up --build     # trained mode; ./models is mounted read-only
docker compose --profile postgres up --build                     # + PostgreSQL on :5433
```

To use PostgreSQL set `DATABASE_URL=postgresql+psycopg://cottonvision:cottonvision@postgres:5432/cottonvision` in the environment
and add `psycopg[binary]` to the backend image (`pip install "psycopg[binary]"` in `backend/Dockerfile` or a derived image).
The backend container runs `alembic upgrade head` before starting Uvicorn.

Ports: backend `8000`, frontend `3000`; the frontend container proxies `/api/backend/*` to `http://backend:8000`.

## 3. Backend on a container platform (Render / Railway / Fly.io / Cloud Run / a VM)

Build from `backend/Dockerfile` with the **repository root as context** (it copies `backend/`, `ml/`, `config/`, `models/`).

Environment variables (see `backend/.env.example`):

| Variable | Production value |
| --- | --- |
| `APP_ENV` | `production` |
| `MODEL_MODE` | `trained` (after §TRAINING) or `mock` |
| `MODEL_REGISTRY_PATH` | `models/registry.json` |
| `MODEL_DEVICE` | `cpu` (or `cuda` on GPU instances) |
| `DATABASE_URL` | managed PostgreSQL URL (`postgresql+psycopg://…`) |
| `UPLOAD_DIR`, `GRADCAM_DIR` | a persistent volume path, e.g. `/data/uploads`, `/data/gradcam` |
| `PUBLIC_BASE_URL` | public origin of the API, e.g. `https://api.cottonvision.example` (used in image URLs) |
| `CORS_ORIGINS` | the frontend origin(s), e.g. `https://cottonvision.example` |
| `MAX_UPLOAD_MB`, `INFERENCE_TIMEOUT_S`, `RATE_LIMIT_PER_MINUTE`, `API_KEY` | as required |
| `LOG_JSON` | `true` for log aggregation |

Health check path: `/api/v1/health` (returns `degraded` with HTTP 200 when the model failed to load — alert on the JSON `status`).

### Getting the model into the container

The image built with `INSTALL_ML=true` includes CPU PyTorch (~1 GB). The model files themselves (`models/exports/<name>/model.pt`, 30–120 MB
depending on architecture, and `models/registry.json`) can be:

1. **Baked into the image** — simplest; commit the export to a release branch or copy it in CI before `docker build`.
2. **Mounted from a volume / downloaded at start** — keep images small; download from object storage into `models/` in an entrypoint,
   then start Uvicorn.
3. **Git LFS** for `models/exports/**` if the repository is the distribution channel.

Memory: ConvNeXt-Tiny/EfficientNetV2-S need ~1–1.5 GB RAM in CPU inference; MobileNetV3-Large ~0.5 GB. Choose instance size accordingly.
Cold start includes loading the model and a warm-up inference (a few seconds on CPU).

### Object storage

`LocalStorage` writes to a volume. For multi-instance deployments implement an S3-compatible `StorageBackend`
(`backend/app/services/storage.py`) that uploads bytes and returns public/presigned URLs; the DB only stores keys.

### Database migrations

Run `alembic -c backend/alembic.ini upgrade head` as a release step (the Docker CMD does this automatically).

## 4. Frontend on Vercel (or any Node host)

- Framework preset: Next.js; root directory: repository root; build `npm run build`.
- Environment variables:
  - `NEXT_PUBLIC_API_URL=https://api.cottonvision.example` → browser calls the backend directly (set `CORS_ORIGINS` accordingly), **or**
  - leave `NEXT_PUBLIC_API_URL` empty and set `BACKEND_INTERNAL_URL=https://api.cottonvision.example` → browser calls `/api/backend/*`
    on Vercel, which proxies server-side (keeps the backend origin private, no CORS). Note that proxied uploads pass through the
    Node runtime; keep `MAX_UPLOAD_MB` moderate.
  - `NEXT_PUBLIC_MAX_UPLOAD_MB` matching the backend.
- Alternatively build `Dockerfile.frontend` and run it next to the backend.

## 5. Reverse proxy / TLS

Terminate TLS at the platform or an Nginx/Caddy in front of both services. Forward `X-Forwarded-Proto` and `X-Forwarded-Host` so the
backend builds correct absolute image URLs (or set `PUBLIC_BASE_URL`). Raise `client_max_body_size` (Nginx) above `MAX_UPLOAD_MB`.

## 6. Observability

- Logs: structured key=value or JSON (`LOG_JSON=true`) with `request_id`, path, status, latency, model, predicted class — never image bytes.
- Every response carries `X-Request-ID` and `X-Process-Time-Ms`.
- `/api/v1/statistics` gives mean latency and unknown rate; `/api/v1/system/info` exposes device/uptime.

## 7. Security checklist

- Set `API_KEY` if the API is public and the frontend proxy is used (the proxy forwards the header; add it server-side in the proxy if desired).
- Restrict `CORS_ORIGINS` to real origins.
- Keep `MAX_UPLOAD_MB` and `MAX_IMAGE_PIXELS` conservative; uploads are validated by magic bytes and fully decoded before inference.
- Storage directories must not be executable/served by another web server.
- Never commit `.env`, `backend/.env` or real datasets.

## 8. Mobile app considerations

The mobile client calls the same public API. For on-device inference later, ship `model.torchscript.pt` (PyTorch Mobile / ExecuTorch)
or `model.onnx` (ONNX Runtime Mobile) together with `metadata.json` (class names, image size, normalisation, temperature) so the
device reproduces the server pipeline exactly.

# Cotton Grade backend image (mock mode by default; set INSTALL_ML=true for trained mode)
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements.txt
COPY ml/requirements.txt ml/requirements.txt
ARG INSTALL_ML=false
RUN pip install -r backend/requirements.txt \
    && if [ "$INSTALL_ML" = "true" ]; then \
         pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu \
         && pip install -r ml/requirements.txt; \
       fi

COPY backend backend
COPY ml ml
COPY config config
COPY models models

RUN mkdir -p backend/storage/uploads backend/storage/gradcam

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').status==200 else 1)"

CMD ["sh", "-c", "alembic -c backend/alembic.ini upgrade head && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]

# Cotton Grade task runner. Run `make help` for a summary.
SHELL := /bin/bash
VENV ?= .venv
PYTHON ?= $(if $(wildcard $(VENV)/bin/python),$(VENV)/bin/python,python3)
PIP ?= $(PYTHON) -m pip
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000
ARCH ?= convnext_tiny
CONFIG ?= config/train.yaml
CHECKPOINT ?= models/checkpoints/baseline_$(ARCH)/best.pt

.DEFAULT_GOAL := help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- setup
install: install-backend install-frontend env ## Install backend (mock mode) + frontend deps and create .env files

install-backend: ## Python deps for API + tests (mock mode; no PyTorch)
	$(PIP) install -r backend/requirements-dev.txt

install-ml: ## PyTorch stack for training / trained mode (install torch for your platform first if needed)
	$(PIP) install -r ml/requirements.txt

install-frontend: ## Node deps
	npm install

env: ## Create .env files from examples if missing
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env
	@echo ".env files ready"

samples: ## Generate synthetic placeholder images in data/samples
	$(PYTHON) scripts/make_sample_images.py

# ---------------------------------------------------------------- run
migrate: ## Apply database migrations (Alembic)
	$(PYTHON) -m alembic -c backend/alembic.ini upgrade head

backend: ## Run FastAPI with reload on :8000
	$(PYTHON) -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

frontend: ## Run Next.js dev server on :3000
	npm run dev -- --port $(FRONTEND_PORT)

dev: ## Run backend + frontend together (Ctrl-C stops both)
	PYTHON="$(PYTHON)" ./scripts/dev.sh

# ---------------------------------------------------------------- quality
test: test-backend test-frontend ## Run all unit/integration tests

test-backend: ## pytest (backend + ml)
	$(PYTHON) -m pytest tests -q

test-frontend: ## vitest
	npm run test

test-e2e: ## Playwright (requires `make dev` running)
	npm run test:e2e

lint: ## ruff + eslint + tsc
	ruff check ml backend tests scripts
	ruff format --check ml backend tests scripts
	npm run lint
	npm run typecheck

format: ## Auto-format Python and check TS
	ruff check --fix ml backend tests scripts
	ruff format ml backend tests scripts

smoke: ## Hit the running backend with a sample image
	./scripts/smoke_test.sh

# ---------------------------------------------------------------- ML
audit: ## Audit data/raw
	$(PYTHON) -m ml.audit_dataset --data-dir data/raw

split: ## Create train/val/test split CSVs
	$(PYTHON) -m ml.split_dataset --config $(CONFIG)

train: ## Train one architecture (ARCH=convnext_tiny)
	$(PYTHON) -m ml.train --config $(CONFIG) --architecture $(ARCH)

train-all: ## Train all four benchmark architectures sequentially
	for a in resnet50 efficientnetv2_s convnext_tiny mobilenetv3_large; do $(PYTHON) -m ml.train --config $(CONFIG) --architecture $$a || exit 1; done

evaluate: ## Evaluate a checkpoint (CHECKPOINT=...)
	$(PYTHON) -m ml.evaluate --checkpoint $(CHECKPOINT)

export: ## Export + register + activate (NAME=..., VERSION=...)
	$(PYTHON) -m ml.export_model --checkpoint $(CHECKPOINT) --name $(or $(NAME),$(ARCH)_v1) --version $(or $(VERSION),1.0.0) --activate

registry: ## Show registry
	$(PYTHON) -m ml.register_model --list

# ---------------------------------------------------------------- docker
docker-build: ## Build images
	docker compose build

docker-up: ## Start frontend + backend (+ postgres profile optional)
	docker compose up --build

docker-down: ## Stop containers
	docker compose down

clean: ## Remove caches and build artefacts
	rm -rf .next node_modules/.cache .pytest_cache .ruff_cache reports/dataset_audit
	find . -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true

.PHONY: help install install-backend install-ml install-frontend env samples migrate backend frontend dev test test-backend test-frontend test-e2e lint format smoke audit split train train-all evaluate export registry docker-build docker-up docker-down clean

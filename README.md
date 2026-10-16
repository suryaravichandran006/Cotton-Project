# Cotton Grade

**Progressive Domain-Adaptive Transfer Learning for Fine-Grained Cotton Cultivar Identification from RGB Fibre Images**

Cotton Grade is a final-year research and engineering project developing an accessible photo-based cotton identification system for small cotton and textile retailers. It studies whether cotton-specific intermediate transfer learning improves raw/ginned cotton cultivar classification when the final labelled fibre dataset is limited.

The central training lineage is:

```text
ImageNet-1K → Cotton Leaves → Cotton Seeds → Raw/Ginned Cotton → Final Cultivar Model
```

The leaf and seed classifiers are **training stages only**. At deployment, Cotton Grade runs one final raw-cotton classifier through a FastAPI backend and a Next.js web application.

## Research question

> Does progressive cotton-domain adaptation improve final cultivar recognition compared with direct ImageNet transfer?

Cotton Grade does not assume that the answer is yes. It implements four controlled routes:

- `baseline`: ImageNet → Final cotton
- `leaf_to_final`: ImageNet → Leaves → Final cotton
- `seed_to_final`: ImageNet → Seeds → Final cotton
- `progressive`: ImageNet → Leaves → Seeds → Final cotton

Every route reuses the exact same final-task split for fair comparison.

## Selected datasets

| Stage | Dataset | Scale | Purpose |
|---|---|---:|---|
| Leaf | Cotton Leaf Image Dataset for Disease Classification | 1,373 originals → 1,124 after exact-duplicate cleaning / 5 classes | Cotton morphology, disease patterns and surface texture |
| Seed | Cotton Seed Quality Dataset — public S1 evaluation set | 450 RGB images / 3 classes | Fine material texture, cracks and local structure |
| Final | CATGO Egyptian Cotton Fibre Dataset | ~3,447 RGB fibre images / 5 cultivars | Final raw-cotton cultivar classification |

Leaf and seed intermediate stages are now trained with real reports: leaf test Macro-F1 0.9880 (167/169 correct) and seed test Macro-F1 0.9561 (65/68 correct). The final CATGO dataset remains pending, so final cultivar metrics are still intentionally absent.

See [`docs/PROGRESSIVE_TRANSFER.md`](docs/PROGRESSIVE_TRANSFER.md) for the complete transfer-learning workflow.

## Website structure

The primary site is a concise, projector-first research briefing:

- `/` — practical problem, exact research question and current evidence boundary
- `/literature` — six primary studies, three themes and the research gap
- `/progress` — completed stages, working implementation and technical refinements
- `/architecture` — complete transfer-learning and deployment architecture
- `/datasets` — stage data and the controlled processing method
- `/results` — leaf and seed evidence, confusion matrices and verified handoff
- `/final-stage` — pending cultivar experiment, four routes and fixed decision rule
- `/analyze` — experimental cotton lab-property analysis

Deeper supporting routes remain available outside the main presentation path:

The local cotton lab-quality pilot is now at `/analyze`, with saved analyses at `/quality/history`. The pending cultivar experiment has moved to `/final-stage`. This is a separate task: a frozen ImageNet encoder compares mean/ridge baselines, CNN regression and a spatial CNN–LSTM head against ten provisional lab-report profiles. It does not establish final cultivar accuracy or laboratory-grade property measurement. See [docs/COTTON_QUALITY.md](docs/COTTON_QUALITY.md) for the complete mapping, training, evaluation, artifact and API workflow. `make quality-train` prepares labels, downloads official weights, compares models and activates the experimental local model.

- `/research` — detailed problem, hypothesis and controlled experiment design
- `/models/leaf` — intermediate model 1
- `/models/seed` — intermediate model 2
- `/experiments` — real experiment comparison; no placeholder metrics
- `/history`, `/statistics`, `/docs`, `/about` — supporting product/research pages

## System capabilities

The existing production-style inference stack is preserved:

- FastAPI REST API
- explicit `mock` / `trained` model modes
- dynamic class inventory from active model metadata
- image validation and safe storage
- calibrated confidence via temperature scaling
- unknown/OOD rejection
- real Grad-CAM explainability
- prediction history and statistics
- SQLite development / PostgreSQL-compatible persistence
- model registry, export and activation pipeline
- Docker + GitHub Actions CI
- mobile-ready API contract

## Supported backbones

Current configurable candidates:

- **ConvNeXt-Tiny** — primary progressive-transfer candidate
- ResNet50 — academic baseline
- EfficientNetV2-S — strong accuracy/efficiency comparison
- MobileNetV3-Large — lightweight/mobile candidate

The final winner is selected from real experiments, not hardcoded assumptions.

## Quick start

### Restore the published lab-quality model

The active quality model and the original T1–T10 lab collection are included. Install [Git LFS](https://git-lfs.com/) before cloning, then run:

```bash
git lfs install
git lfs pull
```

This restores the binary weights for the `/analyze` workflow. Its 85.1% matching score is an exploratory same-known-lot image evaluation, not external/new-lot or physical lab-measurement accuracy. New local training runs, uploaded photos and databases are excluded from Git. The independent cultivar model still uses its separate registry.

### Python environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt -r ml/requirements.txt
```

### Frontend

```bash
npm ci
npm run dev
```

Frontend: `http://localhost:3000`

### Backend

```bash
python -m alembic -c backend/alembic.ini upgrade head
python -m uvicorn backend.app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

By default the backend runs in **mock mode**. Mock responses always expose `is_mock=true`, and the UI displays the demo-state banner.

## Dataset placement

```text
data/stages/
├── leaf/
├── seed/
└── final/
```

Each stage can use normal class folders. For the final dataset, strongly prefer `metadata.csv` with `sample_id` if several images come from the same physical cotton specimen.

Full dataset rules: [`docs/DATASET.md`](docs/DATASET.md).

## Audit datasets

```bash
python -m ml.audit --data-dir data/stages/leaf
python -m ml.audit --data-dir data/stages/seed
python -m ml.audit --data-dir data/stages/final --metadata-csv data/stages/final/metadata.csv
```

## Progressive-transfer dry run

```bash
python -m ml.progressive --route progressive --dry-run
```

This validates the configured route and prints the exact training commands. Missing datasets remain a readiness warning, not a fake training result.

## Train controlled routes

On a CUDA-enabled Colab runtime:

```bash
python -m ml.progressive --route baseline --device cuda
python -m ml.progressive --route leaf_to_final --device cuda
python -m ml.progressive --route seed_to_final --device cuda
python -m ml.progressive --route progressive --device cuda
```

Each route writes final-task reports under:

```text
reports/transfer_<route>/
```

The `/experiments` website reads these artifacts through `/api/v1/research/experiments`. Before real reports exist, it intentionally shows a pending state.

## Manual stage transfer

`ml.train` also supports an explicit earlier-stage checkpoint:

```bash
python -m ml.train \
  --architecture convnext_tiny \
  --data-dir data/stages/seed \
  --splits-dir data/processed/splits/seed \
  --experiment-name seed_stage \
  --init-checkpoint models/checkpoints/leaf_stage/best.pt \
  --transfer-source leaf
```

Only shape-compatible tensors are loaded. This transfers the learned backbone while discarding an incompatible prior classifier head.

## Evaluation rules

Primary metric: **macro-F1**.

Also report:

- balanced accuracy
- accuracy
- per-class precision/recall/F1
- confusion matrix
- calibration / ECE
- training convergence
- inference latency
- parameter count / artifact size

Critical rules:

1. All routes use the same final test split.
2. Calibration is fitted only on validation data.
3. Augmentation happens after split assignment.
4. Images of the same physical specimen never cross splits when `sample_id` is available.
5. The final test set is never used for model selection.
6. No mock or placeholder metric is reported as scientific evidence.

## Export and deploy the winner

Example after a progressive route wins:

```bash
python -m ml.export_model \
  --checkpoint models/checkpoints/transfer_progressive/best.pt \
  --name cottonvision_progressive_v1 \
  --version 1.0.0 \
  --register --activate
```

Then configure:

```env
MODEL_MODE=trained
```

and restart FastAPI. Export metadata preserves the model's transfer lineage.

## Verification

Python:

```bash
python -m pytest tests -q
ruff check ml backend tests scripts
ruff format --check ml backend tests scripts
```

Frontend:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

CI additionally runs a Playwright end-to-end mock inference flow.

## Documentation

- [`docs/PROGRESSIVE_TRANSFER.md`](docs/PROGRESSIVE_TRANSFER.md) — new research/training lineage
- [`docs/TRAINING.md`](docs/TRAINING.md) — full training operations
- [`docs/DATASET.md`](docs/DATASET.md) — dataset integrity and metadata
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/API.md`](docs/API.md) — REST API
- [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md) — experiment framework
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deployment

## Scientific disclaimer

Cotton Grade is a computer-vision decision-support system. It does not replace laboratory fibre testing, verified provenance, or regulatory/commercial quality procedures.

# Cotton Grade — Progressive Transfer Pre-Dataset Readiness Report

**Date:** September 2026  
**Canonical repository:** `suryaravichandran006/Cotton-Project`  
**Branch:** `main`  
**Research architecture:** ImageNet → Cotton Leaves → Cotton Seeds → Raw/Ginned Cotton  
**Current model mode:** Mock until a validated final cultivar artifact is available

## Status

Cotton Grade has been upgraded from a single-stage fibre classifier scaffold into a progressive cotton-domain transfer-learning research system while preserving the production inference application.

The leaf and seed stages have been trained and evaluated with real report artifacts. No final research conclusion is currently claimed because access to the raw-cotton cultivar dataset and the controlled final-route comparison remain pending.

## Selected stages

| Stage | Selected dataset | Role | Current status |
|---|---|---|---|
| Leaf | Cotton Leaf Image Dataset for Disease Classification (1,373 originals; 1,124 after exact-duplicate cleaning; 5 classes) | cotton-domain morphology/texture adaptation | trained; checkpoint + reports produced |
| Seed | Cotton Seed Quality public S1 evaluation set (450 RGB images; 3 classes) | finer material/texture adaptation | trained from leaf checkpoint; checkpoint + reports produced |
| Final | CATGO Egyptian cotton fibre dataset (~3,447 RGB lint images, 5 Giza cultivars) | final cultivar classification | author access pending |

Canonical metadata and the real intermediate-stage metrics are in `config/research.json`. Leaf test Macro-F1 = 0.9880; seed test Macro-F1 = 0.9561. Final cultivar training remains pending.

## Controlled research routes

```text
baseline       ImageNet → Final
leaf_to_final  ImageNet → Leaves → Final
seed_to_final  ImageNet → Seeds → Final
progressive    ImageNet → Leaves → Seeds → Final
```

The final split directory is shared across routes. This prevents a misleading comparison caused by evaluating models on different test specimens.

## Progressive-transfer implementation

Implemented:

- `config/progressive_transfer.yaml` — executable stage/route plan
- `ml.progressive` — route orchestrator and pre-data dry-run
- `ml.train --init-checkpoint ... --transfer-source ...` — stage handoff
- `load_transfer_weights()` — transfers only compatible state-dict tensors
- task-specific classifier heads are skipped when output shapes differ
- transfer reports saved with experiments
- lineage stored in final checkpoint
- lineage preserved by export metadata
- lineage preserved by model registry

Dry-run:

```bash
python -m ml.progressive --route progressive --dry-run
```

Until images exist in all required stage directories, readiness is reported as pending rather than starting fake training.

## Dataset integrity

Stage directories:

```text
data/stages/leaf/
data/stages/seed/
data/stages/final/
```

Audit commands:

```bash
python -m ml.audit --data-dir data/stages/leaf
python -m ml.audit --data-dir data/stages/seed
python -m ml.audit --data-dir data/stages/final --metadata-csv data/stages/final/metadata.csv
```

For the final dataset, `sample_id` metadata is strongly preferred when several images originate from the same physical specimen. Grouped splitting and `check_no_group_leakage()` protect against specimen leakage.

Augmentation occurs after split assignment inside the training loader.

## Website upgrade

The site remains a normal website, not a presentation mode. Its primary narrative is now:

```text
/                 Introduction
/research         Problem + research question
/datasets         Three selected datasets + integrity methodology
/architecture     Progressive training + production inference architecture
/models/leaf      Intermediate model 1
/models/seed      Intermediate model 2
/experiments      Controlled route comparison + real report ingestion
/analyze          Final model lineage + live cotton analyzer
```

Existing supporting pages remain available: history, statistics, docs and about.

The experiments page consumes `GET /api/v1/research/experiments`. If no real experiment artifacts exist, it displays an explicit pending state and no fabricated values.

## Backend upgrade

New read-only research endpoints:

```text
GET /api/v1/research
GET /api/v1/research/experiments
```

The existing production pipeline remains intact:

```text
image validation
→ final trained model
→ temperature calibration
→ OOD/unknown rejection
→ optional Grad-CAM
→ persistence/history
→ structured API response
```

Leaf and seed models are never called during production prediction.

## Test/CI verification

For commit `e2ec08bb55ced02e2355a8d6a78bef3e85483bd6`, GitHub Actions verified:

- Python Ruff lint: passed
- Fresh SQLite Alembic migration: passed
- Backend + ML pytest: **55 passed**
- Frontend TypeScript typecheck: passed
- Frontend ESLint: passed
- Frontend Vitest: passed
- Next.js production build: passed

End-to-end Playwright mock-mode verification is also configured in CI and runs after Python/Web jobs.

## What still requires real data

The following cannot and must not be completed before the final cultivar dataset arrives:

- final cultivar metrics
- comparison between direct vs intermediate transfer routes
- data-efficiency curves
- final confusion matrices
- final calibration values
- final OOD thresholds
- final Grad-CAM qualitative conclusions
- final model selection

No placeholder values should be substituted for these.

## Exact workflow when datasets arrive

### 1. Install datasets

Populate:

```text
data/stages/leaf/
data/stages/seed/
data/stages/final/
```

### 2. Audit

Run all three `ml.audit` commands above.

### 3. Validate route configuration

```bash
python -m ml.progressive --route progressive --dry-run
```

### 4. Establish direct baseline

```bash
python -m ml.progressive --route baseline --device cuda
```

### 5. Run intermediate-route controls

```bash
python -m ml.progressive --route leaf_to_final --device cuda
python -m ml.progressive --route seed_to_final --device cuda
```

### 6. Run progressive transfer

```bash
python -m ml.progressive --route progressive --device cuda
```

### 7. Compare on the same final test set

Primary metric: macro-F1. Also inspect balanced accuracy, per-class recall/F1, confusion matrices, calibration, convergence, latency and size.

### 8. Export the actual winner

Example only if progressive wins:

```bash
python -m ml.export_model \
  --checkpoint models/checkpoints/transfer_progressive/best.pt \
  --name cottonvision_progressive_v1 \
  --version 1.0.0 \
  --register --activate
```

### 9. Serve real predictions

Set:

```env
MODEL_MODE=trained
```

Restart FastAPI. No frontend rewrite is required.

## Scientific interpretation rule

Progressive transfer is a hypothesis, not a promised improvement. If direct ImageNet transfer wins, or if only the leaf/seed route helps, that result is retained and reported. Negative transfer is a valid scientific finding.

See:

- `docs/PROGRESSIVE_TRANSFER.md`
- `docs/TRAINING.md`
- `docs/EXPERIMENTS.md`
- `docs/ARCHITECTURE.md`

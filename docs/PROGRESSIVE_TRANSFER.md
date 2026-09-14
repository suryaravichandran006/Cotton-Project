# Progressive Transfer Learning

Cotton Grade now supports a controlled, multi-stage transfer-learning study:

```text
ImageNet-1K
    ↓
Cotton Leaf Image Dataset (5-class disease/health domain)
    ↓ transfer backbone only
RGB Cotton Seed dataset (seed domain)
    ↓ transfer backbone only
Final raw / ginned cotton cultivar dataset
    ↓
Deploy one final classifier
```

The leaf and seed classifiers are **not** runtime dependencies. Their task heads are discarded. Only compatible backbone tensors are passed forward.

## Research question

> Can a progressively trained vision model help small cotton and textile retailers identify raw cotton cultivar from a single RGB photograph more reliably than direct ImageNet transfer?

The answer is not assumed. Four controlled routes are implemented:

| Route | Training lineage |
|---|---|
| `baseline` | ImageNet → Final cotton |
| `leaf_to_final` | ImageNet → Leaves → Final cotton |
| `seed_to_final` | ImageNet → Seeds → Final cotton |
| `progressive` | ImageNet → Leaves → Seeds → Final cotton |

All routes reuse `data/processed/splits/final/`, so the final validation/test specimens are identical across comparisons.

## Selected datasets

### Stage 1 — Cotton Leaf Image Dataset for Disease Classification

- 13,597 images
- 27 cotton genotypes
- Purpose: cotton-specific morphology and fine surface representation learning
- Source: https://doi.org/10.17632/t9hgvk2h9p.1
- Place under: `data/stages/leaf/`

### Stage 2 — Cotton Seed Quality Dataset (public S1 evaluation set)

- 450 downloadable RGB evaluation images (150 per class)
- Three seed-condition classes: broken, cracked and intact
- The associated paper reports 4,419 development images; Cotton Grade does not claim those as the set used here
- Purpose: fine material texture, local boundaries and surface irregularity representation learning
- Source: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0273057
- Place under: `data/stages/seed/`

Use original images for splitting. Do not treat published augmented views as independent samples.

### Stage 3 — final raw cotton dataset

The planned target is the CATGO Egyptian cotton fibre collection (~3,447 RGB images; Giza 86/87/90/94/96), currently pending author access.

- Source: https://www.mdpi.com/2624-7402/7/5/127
- Place under: `data/stages/final/`
- For scientifically defensible splitting, include `data/stages/final/metadata.csv` with `sample_id` whenever multiple photographs come from the same physical cotton specimen.

## Dataset layout

Folder mode:

```text
data/stages/leaf/<class_name>/*.jpg
data/stages/seed/<class_name>/*.jpg
data/stages/final/<cultivar_name>/*.jpg
```

Metadata mode follows the existing Cotton Grade schema. For the final task, strongly prefer:

```csv
image_path,class_name,sample_id,batch_id,source_id,capture_device
```

Never let images from the same physical sample cross train/validation/test splits.

## Audit first

Each stage should be audited before training:

```bash
python -m ml.audit --data-dir data/stages/leaf
python -m ml.audit --data-dir data/stages/seed
python -m ml.audit --data-dir data/stages/final --metadata-csv data/stages/final/metadata.csv
```

## Validate the experiment plan

No dataset is required to inspect the configured lineage:

```bash
python -m ml.progressive --route progressive --dry-run
```

When the stage directories contain real data, the dry run reports them as ready and prints every command it would execute.

## Run individual controlled routes

```bash
python -m ml.progressive --route baseline --device cuda
python -m ml.progressive --route leaf_to_final --device cuda
python -m ml.progressive --route seed_to_final --device cuda
python -m ml.progressive --route progressive --device cuda
```

On Google Colab, `--device cuda` is recommended. On Apple Silicon, use `--device mps` for development-scale runs.

## What transfer actually does

For a later stage, Cotton Grade first creates the target model with the **new task's class count**. It then loads the earlier checkpoint only where tensor names and shapes match.

This means:

- backbone tensors transfer;
- old classifier tensors with incompatible shapes are skipped;
- previous class names never define the new task's output space;
- `transfer.json` records exactly how many tensors were loaded/skipped;
- the final checkpoint stores lineage metadata.

You can also invoke this manually:

```bash
python -m ml.train \
  --architecture convnext_tiny \
  --data-dir data/stages/seed \
  --splits-dir data/processed/splits/seed \
  --experiment-name manual_seed \
  --init-checkpoint models/checkpoints/manual_leaf/best.pt \
  --transfer-source leaf
```

## Evaluation

Primary metric: **macro-F1**.

Also compare:

- balanced accuracy
- accuracy
- per-class recall/F1
- calibration / ECE
- confusion matrix
- convergence behavior
- inference latency
- model size

The `/experiments` website page reads only real artifacts from:

```text
reports/transfer_baseline/
reports/transfer_leaf_to_final/
reports/transfer_seed_to_final/
reports/transfer_progressive/
```

Before those reports exist, it deliberately displays a pending state instead of fabricated values.

## Data-efficiency study

After the full routes are stable, repeat direct vs progressive transfer with 25%, 50%, 75% and 100% of the **final training split only**. Validation/test sets must remain unchanged. This tests whether domain adaptation is particularly valuable when final cultivar labels are scarce.

## Final deployment

Only the winning **final-task** checkpoint should be exported and registered:

```bash
python -m ml.export_model \
  --checkpoint models/checkpoints/transfer_progressive/best.pt \
  --name cottonvision_progressive_v1 \
  --version 1.0.0 \
  --register --activate
```

The export preserves transfer lineage in `metadata.json` and `model.pt`. Set `MODEL_MODE=trained` and restart FastAPI. The web/mobile inference contract remains unchanged.

## Scientific rules

1. The final test set is untouched until final evaluation.
2. Calibration uses validation data only.
3. All routes use the identical final split.
4. Augmentation happens after splitting, inside the training loader.
5. Multiple photographs of one physical sample share a `sample_id` and stay in one split.
6. No placeholder metric may be reported as a result.
7. If progressive transfer underperforms direct ImageNet transfer, report that result; negative transfer is a valid scientific finding.

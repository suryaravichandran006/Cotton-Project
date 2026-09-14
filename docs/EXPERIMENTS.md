# Experiments — Progressive Cotton-Domain Transfer Learning

This document is the canonical experiment plan for Cotton Grade. **All result cells remain empty until produced from real datasets.** Do not manually type placeholder metrics into reports or the website.

## Research question

> Can a progressively trained vision model help small cotton and textile retailers identify raw cotton cultivar from a single RGB photograph more reliably than direct ImageNet transfer?

## Primary controlled experiment

Use one primary architecture (initially `convnext_tiny`) and compare four transfer routes while holding the final dataset split, preprocessing, optimizer policy, seed, evaluation code and model architecture constant.

| ID | Route | Macro-F1 | Balanced Acc. | Accuracy | ECE | Epochs to best | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| E0 | ImageNet → Final cotton | | | | | | |
| E1 | ImageNet → Leaves → Final cotton | | | | | | |
| E2 | ImageNet → Seeds → Final cotton | | | | | | |
| E3 | ImageNet → Leaves → Seeds → Final cotton | | | | | | |

Run them with:

```bash
python -m ml.progressive --route baseline --device cuda
python -m ml.progressive --route leaf_to_final --device cuda
python -m ml.progressive --route seed_to_final --device cuda
python -m ml.progressive --route progressive --device cuda
```

Before training:

```bash
python -m ml.progressive --route progressive --dry-run
```

Final-task reports are written to:

```text
reports/transfer_baseline/
reports/transfer_leaf_to_final/
reports/transfer_seed_to_final/
reports/transfer_progressive/
```

The `/experiments` website reads these files through `GET /api/v1/research/experiments`. Missing reports are shown as pending, never as fake values.

## Fair-comparison rules

1. Every route must reuse `data/processed/splits/final/`.
2. The final test set must remain untouched until final evaluation.
3. Model selection and early stopping use validation macro-F1.
4. Temperature scaling is fitted on validation logits only.
5. `sample_id` grouping is mandatory when multiple photos come from one physical specimen.
6. Augmentation happens after splitting and only in the training loader.
7. Intermediate classifier heads are discarded; only shape-compatible backbone tensors transfer.
8. Record git commit, dataset fingerprint, split manifests, seed, hardware and configuration for every run.

## What to compare

Primary metric:
- Macro-F1

Supporting metrics:
- balanced accuracy
- accuracy
- per-class precision / recall / F1
- worst-class recall
- confusion matrix
- calibrated ECE / NLL
- epochs to best validation macro-F1
- total training time
- inference latency
- parameter count and artifact size

## Stage diagnostics

### Leaf stage

Record:
- training/validation curves
- macro-F1 and balanced accuracy
- confusion matrix
- Grad-CAM examples
- checkpoint path

The leaf task metric is **diagnostic only**. High leaf accuracy does not prove useful transfer to fibre.

### Seed stage

Record the same items. Also store `transfer.json` to prove that the leaf backbone was loaded while the old leaf head was skipped.

Again, seed-task accuracy is not the research endpoint. The final cotton test set determines whether the transfer was useful.

## Architecture benchmark

Before progressive-route experiments, benchmark supported architectures directly on the final task:

- `resnet50` — academic baseline
- `efficientnetv2_s` — accuracy/efficiency comparison
- `convnext_tiny` — primary progressive-transfer candidate
- `mobilenetv3_large` — lightweight/mobile candidate

Dry-run architecture integrity:

```bash
python -m ml.benchmark --dry-run
```

Full benchmark once final data is available:

```bash
python -m ml.benchmark --config config/train.yaml
```

Do not pick the winner from accuracy alone. Use macro-F1, balanced accuracy, worst-class recall, calibration, latency and size.

## Data-efficiency experiment

After E0–E3 are stable, compare the strongest direct route against the strongest progressive route using only a fraction of the **final training split**:

| Final training fraction | Direct transfer Macro-F1 | Progressive Macro-F1 | Difference |
|---:|---:|---:|---:|
| 25% | | | |
| 50% | | | |
| 75% | | | |
| 100% | | | |

Validation/test sets remain fixed. This experiment answers whether domain-specific transfer is particularly useful when final fibre labels are scarce.

## Augmentation ablation

Run conservative baseline augmentation versus optional lighting augmentation. Cotton colour/lustre may be informative, so lighting transforms must not be assumed beneficial.

| Augmentation | Macro-F1 | Balanced Acc. | Calibration | Observation |
|---|---:|---:|---:|---|
| default | | | | |
| with_lighting | | | | |

## Calibration and OOD

For the selected final model:
- fit temperature on validation logits;
- report ECE/NLL before and after calibration;
- evaluate low-confidence/OOD rejection using a separate non-class/OOD set;
- never tune OOD thresholds on the final test set.

## Grad-CAM audit

Review correctly classified and misclassified final-test images. Record whether attention falls on cotton fibre rather than background, labels, rulers, hands or capture artifacts.

| Image | True | Predicted | Confidence | Fibre-focused? | Observation |
|---|---|---|---:|---|---|
| | | | | | |

## Final conclusion template

Report one of these outcomes honestly:

- progressive transfer materially improves final-task performance;
- only one intermediate domain helps;
- progressive transfer produces no meaningful difference;
- progressive transfer causes negative transfer.

All four are valid scientific outcomes. The project contribution is the controlled evaluation, not a predetermined result.

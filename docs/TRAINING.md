# Training Guide — Progressive Cotton-Domain Transfer Learning

This is the operational training guide for the current Cotton Grade research design.

The canonical pipeline is:

```text
ImageNet-1K → Cotton Leaves → Cotton Seeds → Raw/Ginned Cotton → Final Cultivar Model
```

The two intermediate classifiers exist only during training. Production inference loads one final raw-cotton classifier.

For the reasoning and experiment design, also read `docs/PROGRESSIVE_TRANSFER.md` and `docs/EXPERIMENTS.md`.

## 1. Create the Python environment

Recommended: Python 3.11.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements-dev.txt -r ml/requirements.txt
```

Hardware:

- Google Colab GPU: use `--device cuda` for real training.
- Apple Silicon: use `--device mps` for development/small experiments.
- CPU: supported but not recommended for full training.

Check Apple MPS:

```bash
python - <<'PY'
import torch
print("MPS available:", torch.backends.mps.is_available())
PY
```

Check CUDA:

```bash
python - <<'PY'
import torch
print("CUDA available:", torch.cuda.is_available())
print("Device:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else None)
PY
```

## 2. Place the three datasets

```text
data/stages/
├── leaf/
├── seed/
└── final/
```

### Leaf stage

Selected dataset: Cotton Leaf Image Dataset for Disease Classification (Mendeley Data DOI 10.17632/t9hgvk2h9p.1). Cotton Grade ingested the 1,373 original images and, after exact-duplicate conflict cleaning, trained on 1,124 unique non-conflicting images across five disease/health classes.

```text
data/stages/leaf/<leaf_class>/*.jpg
```

### Seed stage

Selected dataset: Cotton Seed Quality Dataset public S1 evaluation set from Du et al. (PLOS ONE). Cotton Grade uses the downloadable 450-image set (150 broken, 150 cracked, 150 intact); the paper separately reports 4,419 development images that are not the set used in this run.

```text
data/stages/seed/<seed_class>/*.jpg
```

Use original images. Do not pre-expand the dataset using published augmentation folders and then randomly split those images.

### Final stage

Planned target: CATGO Egyptian Cotton Fibre Dataset, pending author access.

```text
data/stages/final/<cultivar>/*.jpg
```

If several photographs belong to one physical cotton specimen, create:

```text
data/stages/final/metadata.csv
```

Example:

```csv
image_path,class_name,sample_id,batch_id,source_id,capture_device
Giza_86/img_001.jpg,Giza_86,G86_sample_001,batch_01,CATGO,camera_a
Giza_86/img_002.jpg,Giza_86,G86_sample_001,batch_01,CATGO,camera_a
```

`sample_id` is critical: every image of one physical specimen must remain in one split.

## 3. Audit every dataset before training

```bash
python -m ml.audit --data-dir data/stages/leaf
python -m ml.audit --data-dir data/stages/seed
python -m ml.audit --data-dir data/stages/final --metadata-csv data/stages/final/metadata.csv
```

Inspect image counts, class balance, corrupt images, dimensions, channels, exact/near duplicates and specimen metadata.

Do not train until label/duplicate problems are resolved.

## 4. Split policy

The progressive orchestrator uses these saved split directories:

```text
data/processed/splits/leaf/
data/processed/splits/seed/
data/processed/splits/final/
```

The **final** split directory is shared by every controlled transfer route. This is intentional: all routes must be evaluated on the exact same final validation/test specimens.

Where `sample_id` exists, grouped splitting prevents physical specimens crossing partitions. Folder-only splitting cannot prove specimen isolation.

## 5. Verify model architecture support before data training

```bash
python -m ml.benchmark --dry-run
```

Current configured candidates:

- `convnext_tiny` — primary progressive-transfer candidate
- `resnet50` — academic baseline
- `efficientnetv2_s` — strong comparison
- `mobilenetv3_large` — lightweight/mobile comparison

Dry-run validates model creation, forward pass and Grad-CAM layer compatibility using synthetic tensors. It does not produce research metrics.

## 6. Inspect the progressive plan

Configuration:

```text
config/progressive_transfer.yaml
```

Validate without training:

```bash
python -m ml.progressive --route progressive --dry-run
```

Before real datasets are installed, the command should report dataset readiness as pending rather than pretending the route can train.

## 7. Train the direct baseline

This is mandatory. Without it, there is no evidence that intermediate cotton domains helped.

```bash
python -m ml.progressive --route baseline --device cuda
```

Lineage:

```text
ImageNet → Final raw cotton
```

Final report:

```text
reports/transfer_baseline/
```

## 8. Train leaf-to-final

```bash
python -m ml.progressive --route leaf_to_final --device cuda
```

Lineage:

```text
ImageNet → Cotton leaves → Final raw cotton
```

The leaf task head is discarded before final training.

## 9. Train seed-to-final

```bash
python -m ml.progressive --route seed_to_final --device cuda
```

Lineage:

```text
ImageNet → Cotton seeds → Final raw cotton
```

The seed head is discarded before final training.

## 10. Train the full progressive route

```bash
python -m ml.progressive --route progressive --device cuda
```

Lineage:

```text
ImageNet → Leaves → Seeds → Final raw cotton
```

At each transition, `load_transfer_weights()` loads only state-dict tensors whose keys and shapes match the new model. The old task classifier head is therefore skipped when its output shape differs.

## 11. Manual checkpoint transfer

If you need to debug one handoff:

```bash
python -m ml.train \
  --config config/train.yaml \
  --architecture convnext_tiny \
  --data-dir data/stages/seed \
  --splits-dir data/processed/splits/seed \
  --experiment-name manual_seed \
  --init-checkpoint models/checkpoints/manual_leaf/best.pt \
  --transfer-source leaf \
  --device cuda
```

The report directory includes `transfer.json` with loaded/skipped tensor counts and source-class metadata.

## 12. What gets saved

Each experiment stores reproducibility information under `reports/<experiment>/` and its checkpoint under `models/checkpoints/<experiment>/`.

Important outputs include:

- config
- split summary
- training history
- validation metrics
- calibration data
- final test metrics
- transfer lineage
- git commit
- checkpoint path

## 13. Primary model-selection metric

Use **macro-F1** as the primary metric.

Also compare:

- balanced accuracy
- accuracy
- per-class recall/F1
- worst-class recall
- confusion matrix
- ECE/NLL calibration
- training convergence
- inference latency
- parameter count/model size

Do not select solely by accuracy.

## 14. Calibration

Temperature scaling is fitted on validation logits and stored in the checkpoint/export metadata.

Never calibrate on the final test set.

## 15. OOD / unknown rejection

The final model must not force every arbitrary image into a cultivar. Keep the existing configurable confidence/OOD rejector pipeline and validate it on a separate OOD set after final training.

OOD threshold selection must not use the final test set.

## 16. Grad-CAM

Grad-CAM is used for qualitative bias auditing and user-facing explanation.

Verify that final-model attention is on cotton fibre rather than background, text, rulers, hands or capture artifacts.

## 17. Architecture benchmark

Once the final dataset exists, compare supported backbones directly on the final task:

```bash
python -m ml.benchmark --config config/train.yaml
```

Use this to decide whether ConvNeXt-Tiny remains the best backbone before spending time on the full progressive study.

## 18. Data-efficiency experiment

After the main four transfer routes are complete, compare direct versus progressive transfer at:

- 25% final training data
- 50%
- 75%
- 100%

Only subsample the final **training** partition. Validation/test sets remain identical.

## 19. Optional lighting augmentation ablation

Lighting transforms are disabled by default because colour/lustre may contain useful cotton cues.

Compare:

- default conservative augmentation
- `with_lighting`

Report whether lighting augmentation helps rather than assuming it does.

## 20. Export the winning final model

Example:

```bash
python -m ml.export_model \
  --checkpoint models/checkpoints/transfer_progressive/best.pt \
  --name cottonvision_progressive_v1 \
  --version 1.0.0 \
  --register --activate
```

If another route wins, export that route instead.

The export preserves transfer lineage.

## 21. Validate an artifact before activation

```bash
python -m ml.validate_artifact --artifact-dir models/exports/cottonvision_progressive_v1
```

Validation checks architecture loading, class mapping, numerical inference, Grad-CAM and calibration metadata.

## 22. Activate an already registered model

```bash
python -m ml.activate_model --name cottonvision_progressive_v1
```

## 23. Switch backend to trained mode

Set:

```env
MODEL_MODE=trained
```

Then restart FastAPI:

```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```

Verify:

```bash
curl -s http://localhost:8000/api/v1/models/active
curl -s http://localhost:8000/api/v1/classes
```

## 24. Start the website

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The research pages explain the complete lineage. `/experiments` loads real experiment reports through FastAPI. `/analyze` uses the active final model.

## 25. Google Colab workflow

Typical sequence:

```python
from google.colab import drive
drive.mount('/content/drive')
```

Then:

```bash
git clone <your-repository-url>
cd Cotton-Project
pip install -r backend/requirements-dev.txt -r ml/requirements.txt
python - <<'PY'
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "No CUDA")
PY
```

Place/mount datasets into `data/stages/leaf`, `data/stages/seed`, and `data/stages/final`, or symlink/copy them from Drive.

Use Drive for persistent checkpoint backups because Colab runtime storage is temporary.

Example:

```bash
python -m ml.progressive --route progressive --device cuda
cp -r models/checkpoints "/content/drive/MyDrive/Cotton Grade/"
cp -r reports "/content/drive/MyDrive/Cotton Grade/"
```

## Troubleshooting

### CUDA out of memory

Lower `batch_size` in `config/progressive_transfer.yaml` (e.g. 32 → 16 → 8).

### MPS instability

Use a smaller batch size and fewer data-loader workers; fall back to CPU for debugging.

### Checkpoint architecture mismatch

Progressive stages must use the same backbone architecture. The training CLI rejects a checkpoint whose recorded architecture differs from the target.

### New dataset classes

No source-code change is required. The target head is created from the new dataset class count and exported class mapping.

### Poor final performance

Check in this order:

1. specimen leakage / duplicates
2. class imbalance
3. background/capture shortcuts
4. direct baseline vs progressive result
5. negative transfer from an intermediate stage
6. augmentation strength
7. model capacity/resolution

### Progressive route underperforms baseline

Do not hide it. That is a valid negative-transfer result. Use the controlled experiments to determine whether leaves, seeds, both, or neither are beneficial.

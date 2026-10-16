# models/

| Path | Purpose |
| --- | --- |
| `registry.json` | Which model the API serves (`active_model`) and metadata for every registered model. Managed by `python -m ml.register_model`. |
| `checkpoints/<experiment>/best.pt`, `last.pt` | Written by `python -m ml.train`. Git-ignored. |
| `exports/<name>/model.pt`, `metadata.json`, `model.torchscript.pt`, `model.onnx` | Written by `python -m ml.export_model`. Git-ignored. |

The cultivar registry remains empty (`active_model: null`), so the independent cultivar demonstration uses `MODEL_MODE=mock`. See `docs/TRAINING.md` §11–13 for its export → register → activate workflow.

The separate cotton lab-quality pilot has a direct-transfer baseline and a progressive model:

| Path | Purpose |
| --- | --- |
| `quality/active.json` | Relative pointer and checksum for the active serving bundle. |
| `quality/runs/20261016T053517996518Z/` | Active progressive pilot: one restored leaf → seed timm backbone shared by T-label matching and the newly trained CNN–LSTM property head. Includes hashes, labels and controlled route evaluations. |
| `quality/runs/20261014T100934100536Z/` | Preserved direct-transfer torchvision baseline, with 85.1% exploratory known-lot matching accuracy. |
| `checkpoints/pt_progressive_leaf/best.pt`, `checkpoints/pt_progressive_seed/best.pt` | Original restored training checkpoints; exact identities are recorded in `data/metadata/transfer_checkpoints.json`. |

Install Git LFS before cloning, or run `git lfs install` and `git lfs pull` in an existing checkout. A source ZIP without restored LFS objects is not a runnable model bundle. The quality service validates all required serving checksums and never substitutes mock measurements.

Binary `.pt` and `.npz` files use Git LFS. The progressive matching evaluation is 231/303 (76.2%); its matched timm direct control scores 241/303 (79.5%) and leaf-only control 210/303 (69.3%). Intermediate transfer has not improved over its direct control in this experiment. The 85.1% torchvision model is a different pretraining baseline, not the progressive model's score. All are exploratory same-known-lot image evaluations, not external/new-lot or lab-measurement accuracy. Original images and the PDF are in `Lab Reports/`; provenance remains provisional.

Other local model runs, download caches, incomplete trials, uploads and databases stay ignored. New training runs are not automatically published: deliberately update the active bundle and Git tracking exceptions when publishing another version.

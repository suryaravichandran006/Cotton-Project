# models/

| Path | Purpose |
| --- | --- |
| `registry.json` | Which model the API serves (`active_model`) and metadata for every registered model. Managed by `python -m ml.register_model`. |
| `checkpoints/<experiment>/best.pt`, `last.pt` | Written by `python -m ml.train`. Git-ignored. |
| `exports/<name>/model.pt`, `metadata.json`, `model.torchscript.pt`, `model.onnx` | Written by `python -m ml.export_model`. Git-ignored. |

The cultivar registry remains empty (`active_model: null`), so the independent cultivar demonstration uses `MODEL_MODE=mock`. See `docs/TRAINING.md` §11–13 for its export → register → activate workflow.

The separate cotton lab-quality pilot is trained and published:

| Path | Purpose |
| --- | --- |
| `quality/active.json` | Relative pointer and checksum for the published serving bundle. |
| `quality/runs/20261014T100934100536Z/` | Complete frozen pilot: ConvNeXt T-label classifier, CNN–LSTM property head, reference labels, hashes and evaluation evidence. Binary `.pt` and `.npz` files use Git LFS. |

Install Git LFS before cloning, or run `git lfs install` and `git lfs pull` in an existing checkout. A source ZIP without restored LFS objects is not a runnable model bundle. The quality service validates all required serving checksums and never substitutes mock measurements.

The published matching evaluation is 258/303 (85.1%) for held-out photographs of the same ten known lots. It is exploratory, not external/new-lot or lab-measurement accuracy. Original training images and the lab PDF are in `Lab Reports/`; data provenance remains provisional.

Other local model runs, download caches, incomplete trials, uploads and databases stay ignored. New training runs are not automatically published: deliberately update the active bundle and Git tracking exceptions when publishing another version.

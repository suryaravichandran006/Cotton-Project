# models/

| Path | Purpose |
| --- | --- |
| `registry.json` | Which model the API serves (`active_model`) and metadata for every registered model. Managed by `python -m ml.register_model`. |
| `checkpoints/<experiment>/best.pt`, `last.pt` | Written by `python -m ml.train`. Git-ignored. |
| `exports/<name>/model.pt`, `metadata.json`, `model.torchscript.pt`, `model.onnx` | Written by `python -m ml.export_model`. Git-ignored. |

The repository ships with an **empty registry** (`active_model: null`) because no cotton
dataset/model exists yet. The backend therefore runs in `MODEL_MODE=mock`.
See `docs/TRAINING.md` §11–13 for export → register → activate.

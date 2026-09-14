# data/

| Directory | Contents | Tracked in git? |
| --- | --- | --- |
| `raw/` | **The cotton dataset.** One sub-folder per variety, e.g. `raw/Giza_86/*.jpg`. | No (`.gitignore`) |
| `processed/splits/` | `train.csv`, `val.csv`, `test.csv`, `class_map.json`, `split_summary.json` written by `python -m ml.split_dataset` / `ml.train`. Commit these for reproducibility if the dataset is fixed. | No by default |
| `samples/` | Synthetic placeholder images produced by `python scripts/make_sample_images.py`. They are **not** cotton and **not** training data — they only exercise the upload pipeline and e2e tests. | Yes |

## Where to put the dataset

```
data/raw/
├── Giza_86/
│   ├── IMG_0001.jpg
│   └── ...
├── Giza_87/
├── Giza_90/
└── ...
```

Folder names become class names verbatim (`Giza_86`). Allowed extensions: `.jpg .jpeg .png .webp .bmp .tif .tiff`.
Anything else is ignored and reported by the audit tool.

If several photographs come from the same physical cotton specimen, also provide a metadata CSV
(`image_path,class_name,sample_id,batch_id,source,capture_device`) so that splitting can be grouped — see
[`docs/DATASET.md`](../docs/DATASET.md).

Then follow [`docs/TRAINING.md`](../docs/TRAINING.md).

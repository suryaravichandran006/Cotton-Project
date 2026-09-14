# Stage datasets

Place real datasets here; image binaries are intentionally not bundled with the repository.

```text
data/stages/
├── leaf/   # Cotton Leaf Image Dataset for Disease Classification
├── seed/   # 450-image Cotton Seed Quality public evaluation set
└── final/  # raw/ginned cotton cultivar dataset
```

Run `python -m ml.audit` on every stage before training. For the final cultivar dataset, add `metadata.csv` with `sample_id` whenever multiple photographs were captured from the same physical cotton specimen. See `docs/PROGRESSIVE_TRANSFER.md` and `docs/DATASET.md`.

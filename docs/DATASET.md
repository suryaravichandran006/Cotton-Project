# DATASET.md — what a scientifically valid cotton fibre dataset looks like

The quality of this project is bounded by the dataset far more than by the choice of network. This document defines what
"valid" means for Cotton Grade and why.

## 1. Subject matter

- **In scope:** photographs of raw (seed cotton after removal of seeds) or ginned cotton fibre / lint, as it would be inspected at a
  gin, warehouse, laboratory or mill.
- **Out of scope:** leaves, flowers, whole plants, bolls on the plant, yarn, fabric, disease or pest symptoms.
- The label is the **variety / cultivar** (e.g. `Giza_86`, `Shankar_6`), not a grade or quality class.

## 2. Directory layout and metadata

```
data/raw/<class_name>/<image files>
```

plus, when several images share a physical specimen, a metadata CSV:

```csv
image_path,class_name,sample_id,batch_id,source,capture_device
```

| Column | Required | Meaning |
| --- | --- | --- |
| `image_path` | yes | relative to `data/raw` (or absolute) |
| `class_name` | yes | must equal the folder name |
| `sample_id` | recommended | identifier of the physical cotton specimen (a handful/bale/lab sample) |
| `batch_id` | optional | capture session or bale lot |
| `source` | optional | farm / gin / lab / supplier |
| `capture_device` | optional | phone model or camera |

## 3. Independent physical samples — the single most important rule

> **If 20 photographs are generated from the same physical cotton specimen, they must not be treated as 20 independent test examples.**

> [!IMPORTANT]
> **Folder-only datasets cannot guarantee specimen-level leakage prevention.**
> For scientifically valid grouped evaluation, metadata with `sample_id` is strictly required. If a dataset is structured solely as directory folders without specimen tags, multiple photographs of the identical physical cotton sample under different lighting or angles will inevitably leak across train, validation, and test splits, leading to artificial test accuracy inflation.

A network can memorise the exact arrangement of fibres, the shadow pattern or a speck of trash in a specimen. If photographs of that
specimen appear in both training and test sets, test accuracy measures memorisation, not the ability to recognise the cultivar on
unseen cotton. This is *data leakage*, and it inflates results dramatically.

Consequences for data collection:

1. Record a `sample_id` for every photograph.
2. Collect **many different specimens per variety** (different bales, fields, seasons if possible), not many photographs of one specimen.
3. Aim for ≥ 30 independent specimens per class as a minimum; 100+ is much better. Multiple photographs per specimen (different
   angles/lighting) are fine and useful — they just stay in the same split.
4. Splitting is grouped by `sample_id` automatically (`group_by: auto`) when the column is populated; `split_summary.json` reports `no_group_leakage: true`.

## 4. Augmentation and leakage

> **If augmented versions are created, augmentations of a source image must NEVER cross dataset splits.**

Cotton Grade applies augmentation *on the fly during training only* (Albumentations presets), so nothing augmented is ever written
to `data/raw`. Do not pre-generate flipped/rotated copies into the dataset folder: they inflate counts, they are exact-texture
duplicates and the audit will flag many of them as near-duplicates.

## 5. Recommended minimums

| Quantity | Minimum to start | Recommended |
| --- | --- | --- |
| Classes | 2 | as many as the target market needs |
| Independent specimens per class | 30 | 100+ |
| Images per class | 150 | 500–1000 |
| Image resolution (shorter side) | 512 px | 1000–2000 px (resized to 224–320 for training) |

More images of the *same* specimens do not substitute for more specimens.

## 6. Class balance

Keep classes within a 1:2 ratio of each other where possible. The audit prints the imbalance ratio; above 3:1 use
`class_weights: true` and rely on macro-F1 / per-class recall rather than accuracy when comparing models.

## 7. Capture protocol (diversity that generalises)

- **Lighting:** capture each specimen under at least two lighting conditions (daylight, indoor LED). Avoid coloured light and
  strong directional shadows; do not use the flash unless it is part of the deployment scenario.
- **Camera diversity:** use more than one phone/camera per class. If only one device photographs class A and another class B, the model
  learns the sensor, not the cotton. Record `capture_device`.
- **Background:** neutral, matte (grey card, black cloth). Keep backgrounds consistent *across classes* so background ≠ label. Fill the frame
  with fibre; the model sees a centre crop.
- **Scale and focus:** roughly constant distance (10–25 cm); sharp focus; fibre fills ≥ 80 % of the frame.
- **No labels in frame:** no tags, handwriting, stickers or rulers — they become shortcuts (Grad-CAM will reveal this).
- **Presentation:** loosened lint, not compressed bales; photograph both the surface and a freshly opened tuft.
- **Orientation:** any. Loose fibre has no canonical up, which is why vertical flips are enabled in the default augmentation.

## 8. Duplicates and near-duplicates

Run `python -m ml.audit_dataset`. Remove exact duplicates. Review near-duplicate pairs: if they are several shots of one
specimen, keep them but make sure they share a `sample_id`; if they are accidental re-uploads, delete one.

## 9. Split strategy

Default 70 / 15 / 15 (train / val / test), stratified by class and grouped by `sample_id` when available, seeded (`seed: 42`),
saved to `data/processed/splits/*.csv` and reused for every experiment so architectures are compared on identical data.

- **Validation** drives early stopping, model selection and temperature calibration.
- **Test** is touched once per final model for reporting. Never tune on it.
- For very small datasets consider repeated grouped k-fold (extension) and report mean ± std.

## 10. Unknown / negative samples (optional but valuable)

Collect a small set of *out-of-distribution* images — other fibres (wool, polyester), other cotton varieties not in the class list,
paper, fabric, empty backgrounds. Keep them **out of `data/raw`** (they are not classes) in e.g. `data/ood/`. Use them to choose the
unknown threshold and to report a rejection rate in `docs/EXPERIMENTS.md` (E8).

## 11. Metadata beyond the minimum

If available, record for each specimen: harvest year, region, ginning method, moisture, and HVI measurements (staple length,
micronaire, strength, colour Rd/+b). These enable future extensions (quality grading, HVI regression) and let you analyse errors
by agronomic similarity.

## 12. Data ethics and licensing

- Obtain permission from farms / gins / labs; document provenance per `source`.
- Do not scrape web images: unknown licences, unknown labels, unknown duplicates.
- Do not photograph people or identifiable property; strip EXIF GPS if location is sensitive (`exiftool -gps:all= *.jpg`).
- State the dataset licence in `data/raw/LICENSE` (e.g. CC BY-NC 4.0) and cite contributors in the report.

## 13. Why quality beats quantity

A thousand photographs of five specimens teach the network five specimens. Two hundred photographs of two hundred specimens teach
it the cultivar. Diversity in specimens, devices and lighting — together with grouped splitting — is what makes the reported
macro-F1 believable to an examiner and useful to a mill.

## 14. Checklist before training

- [ ] One folder per variety under `data/raw`, names without spaces
- [ ] No augmented copies stored on disk
- [ ] Metadata CSV with `sample_id` if specimens have multiple photographs
- [ ] `python -m ml.audit_dataset` reports no corrupt files and no `LEAKAGE RISK`
- [ ] Class imbalance < 3:1 or `class_weights` enabled
- [ ] ≥ 2 devices and ≥ 2 lighting conditions per class
- [ ] Backgrounds consistent across classes, no labels in frame
- [ ] Split summary shows `no_group_leakage: true`

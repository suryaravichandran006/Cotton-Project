# Cotton lab-quality pilot

This workflow estimates cotton properties from one RGB photograph of loose fibre. The restored leaf → seed ConvNeXt backbone now feeds the lab pilot's matching and property tasks. Its T1–T10 lot labels are a different task from the pending cultivar classifier at `/final-stage`; quality analysis is at `/analyze`.

## Progressive transfer from the restored checkpoints

The supplied original files are identified by their experiment metadata, not their download names. `data/metadata/transfer_checkpoints.json` records their SHA-256 fingerprints: `models/checkpoints/pt_progressive_leaf/best.pt` is the five-class leaf model, and `models/checkpoints/pt_progressive_seed/best.pt` is the three-class seed model. The seed metadata records 180 tensors transferred from the leaf experiment, with both old classifier tensors discarded. Historical initialization is recorded in that metadata; the original training did not record a parent checkpoint checksum.

```sh
python -m ml.quality.download_progressive_baseline
python -m ml.quality.train_progressive --allow-provisional --activate
# Apple GPU when available: add --device mps
# Equivalent: make quality-progressive DEVICE=mps
```

The converter uses PyTorch's restricted weights loader (with only the standard TorchVersion metadata type added), verifies the original experiment and architecture, discards both task-head tensors unconditionally, and strictly loads all 180 backbone tensors into the same timm ConvNeXt implementation used for the earlier training. It never substitutes torchvision weights or a random encoder. The serving export contains tensor weights only.

The final backbone is frozen. New cotton classifiers are trained on its features; mean, ridge, CNN and spatial CNN–LSTM property heads are evaluated and refitted using its 768-channel spatial features. Both serving branches share one verified backbone instance. This is progressive transfer with new final-task heads, not end-to-end fine-tuning of the backbone on fibre images.

Matching controls compare (1) the original official `timm/convnext_tiny.in12k_ft_in1k` pretraining, (2) the restored leaf checkpoint and (3) the restored leaf → seed checkpoint. All use identical eligible photographs, transforms, candidate settings and nested inner/outer image splits. The progressive route is fixed by the research question; test scores do not select the installed route. No independently trained ImageNet → seed checkpoint was supplied, so that fourth control is unavailable. The earlier torchvision/ImageNet-1K 85.1% result is a historical baseline, not the new model's score or a controlled estimate of transfer benefit.

The active run `20261016T053517996518Z` measures **231/303 = 76.2%** progressive matching accuracy, versus **241/303 = 79.5%** for the matched direct control and **210/303 = 69.3%** for leaf-only transfer. Progressive transfer underperforms the direct control by 3.3 percentage points; no improvement or 85% target achievement is claimed. The new property comparison selects CNN–LSTM by validation MAE. Exact route comparisons and final-task evaluations remain in the new immutable `evaluation.json`. The compact page shows the actual installed model's headline metrics and a short transfer sequence without restoring the removed detailed tables. An independent external evaluation is still required.

## Evidence and scope

The supplied collection contains 344 JPEG files across T1–T10. Full pixel decoding excludes two empty files and one truncated image, leaving 341 usable photographs. A visually reviewed view manifest excludes 38 prepared-fibre/ruler photographs from the first loose-fibre experiment: 303 training photographs across ten independently labelled lot profiles.

`data/metadata/lab_quality.json` transcribes the Average and numeric Std.Dev. rows from the ten numbered HVI report pages. It retains the original report SHA-256, dates, four-test count, categorical grade codes, and unconfirmed fields. The original PDF is authoritative; the app provides it for all individual test rows, CV%, Q99%, minima and maxima. Report SD is reference information, never a model prediction interval.

The labels remain `provisional_lot_average`. Handwritten page numbers support the correspondence, but physical photo-to-lab provenance, per-bale photograph links, capture dates and the meaning of “40's” remain unconfirmed. The explicit `--allow-provisional` switch enables a research pilot, not certification. Do not mark the dataset verified until those issues are resolved.

SL2 and UR retain their instrument codes: span percentage is not established, and these must not be silently renamed UHML/UI. Amt has an unconfirmed meaning and is not estimated. The source Grade field is blank. Moisture labels refer to the lab measurement date and may not describe the later photographed material.

## Original direct-transfer baseline

From the repository root with the Python requirements installed:

```sh
python -m ml.quality.data
python -m ml.quality.download_backbone
python -m ml.quality.train --allow-provisional --activate
```

The download uses the official torchvision MobileNetV3-Small ImageNet-1K V1 weights; model files and their download cache stay under `models/quality/`. It does not upload cotton photographs. No random-weight encoder is substituted when weights are unavailable.

Optional training arguments:

```sh
python -m ml.quality.train \
  --images 'Lab Reports' \
  --labels data/metadata/lab_quality.json \
  --backbone models/quality/backbone.pt \
  --epochs 60 --batch-size 16 --seed 42 \
  --allow-provisional --activate
```

The original photographs are never rewritten or deleted. The manifest tracks hashes, dimensions, lot IDs, view types, eligibility, and exclusion reasons. Exact duplicates are excluded; conflicting duplicates fail preparation. Metadata files distinguish visually reviewed prepared fibres from loose-fibre photographs. Near duplicates are not counted as independent lab labels; whole-lot grouping prevents same-lot photos crossing a fold's partitions.

## Model comparison

Every candidate uses the same encoder, images and lot-isolated splits:

- `mean`: equal-weight training-lot means; categorical majority baseline.
- `ridge`: frozen CNN features with ridge regression; categorical majority baseline.
- `cnn`: frozen CNN encoder with a learned projection/pooling regression head and categorical heads.
- `cnn_lstm`: the same encoder and projection, followed by one small LSTM over a 4×4 spatial grid in row-major order; independent numeric and categorical outputs.

The LSTM sequence is spatial features of one photograph. T1–T10 are never treated as time steps. The encoder stays frozen during final-task head training. The original command above uses direct ImageNet MobileNet features; `train_progressive` uses the restored timm leaf → seed backbone for all these candidates. Their property-model comparisons must be evaluated separately, rather than carrying over the earlier model's metrics.

Each of five outer folds holds out two whole lots, uses two other lots for validation, and six for training. Numeric target scaling and feature normalization are fitted inside the training partition. Lot-balanced loss prevents larger photograph folders dominating target fitting. Neural heads use Huber regression loss and categorical cross-entropy, with validation early stopping.

The pilot architecture is chosen by mean normalized validation MAE across folds, before reading test outputs. Candidate test results are exploratory comparisons from the same small collection: the global selection procedure shares this collection across folds, so they are **not an independent final-test score for the selected model**. External untouched lots are still required. MAE/RMSE are single-photo errors averaged within each held-out lot and then across lots, so each lot receives equal weight. `lot_mean_mae` is separately retained for the average-prediction diagnostic.

After comparison, the selected architecture is fitted on all ten lots using the median selected epoch count. Its training fit is not reported as test evidence. No calibrated prediction intervals are claimed. The stored report lists every fold's lot IDs, candidate metrics, held-out predictions and final-refit provenance.

## Known-lot reference matching evaluation

The nearest-reference T label uses the frozen CNN’s pooled visual features and cosine similarity to lot centroids. It is independent of the property regression head. Five stratified image folds measure retrieval among the same ten known lots: every query photograph is excluded from its fold’s reference centroids, and each photograph is queried once. Physical lots and unknown capture sessions still overlap, so this does not establish origin identification or performance on unseen lots.

The original centroid matcher measured 161 correct matches among 303 held-out photographs (53.1% accuracy). The historical direct-transfer torchvision ConvNeXt selection procedure measured 258/303 (85.1%) in nested image cross-validation; see the upgrade protocol below. Its immutable evaluation stores fold assignments, true and predicted labels, overall and balanced accuracy, macro precision/recall/F1, the confusion matrix and per-lot metrics. The analysis page shows the working diagram and headline matching metrics, then ends after the matching evaluation scope. The target-status line is omitted from the page. At the user’s request, the matching-method table and all subsequent evaluation details were removed from this page to reduce information overload. Full candidate comparisons, confusion matrices and numeric MAE/RMSE remain in the immutable evaluation artifact. Regression errors are never converted into an “accuracy” percentage.

## Upgrade known-lot matching

After training the property model, run:

```sh
python -m ml.quality.train_matching --allow-provisional --activate
```

`make quality-matching` runs this comparison followed by the ConvNeXt comparison described below. It trains separate T1–T10 classifiers while retaining the exact numeric property weights, normalization, reference labels and regression evaluation from the source bundle. Model choice, preprocessing, class order and file hashes travel with the new immutable bundle. Serving loads numeric coefficient arrays or weights-only Torch checkpoints; it never deserializes a pickled sklearn estimator.

The candidate set comprises standardized frozen CNN features with a balanced logistic classifier at 224px and 336px, plus a ten-class CNN at 336px. The CNN freezes the first nine MobileNet feature blocks and trains the last four with its new classifier head. Batch-normalization running statistics stay at their pretrained values. Training randomly selects the original, horizontal-flipped, vertical-flipped or 90-degree rotated view of each training photo. Validation and query photos use the original center view. Caching a fixed pretrained prefix applies no data-dependent fitting; all fitting and augmentation sampling use training source indices only.

Five stratified outer image folds each set aside query photographs. A stratified 20% split inside the remaining photographs supplies validation for classifier selection by balanced accuracy and CNN early stopping. Each candidate then refits only the outer training photos; the CNN uses its previously selected epoch count. The selected candidate’s outer query predictions form the headline nested evaluation. Additional candidate results from these shared folds are explicitly exploratory comparisons.

After recording those predictions, three-fold validation over the full collection selects the installed classifier. Its final fit uses all available source photographs and, for the CNN, the median validation-selected epoch count. This final training fit is not reported as accuracy. The headline score evaluates the selection procedure; it is not an untouched external test of the final all-photo fit. Capture sessions and near duplicates remain unconfirmed, and physical lots still overlap across image folds.

Serving keeps the reference-envelope capture heuristic independent of the classifier-assigned label. A predicted T label retrieves the corresponding saved lab profile; it does not verify origin. The report retains the original 53.1% centroid comparison, the current selection score, all per-lot metrics, exact source-photo fold indices, final-selection scores and the 85% target status. New saved results identify their matcher; older saved results preserve their original matcher and reference values.

Running `quality-train` again creates a new property-model bundle with the original centroid matcher. Run `quality-matching` afterward to compare and attach a trained matcher to that new bundle.

## Installed ConvNeXt matching upgrade

```sh
python -m ml.quality.download_matching_backbone
python -m ml.quality.train_convnext_matching --allow-provisional --activate
# Equivalent shortcut:
make quality-convnext
```

The completed run `20261014T100934100536Z` uses official ImageNet1K V1 ConvNeXt-Tiny weights, frozen feature extraction, training-only feature scaling and a class-balanced logistic classifier. Candidate inputs are the original 224px center view, the average of four orientation views at 224px, their concatenation, a 336px view, and concatenated 224px/336px features. Each mode compares regularization C=0.1, 1 and 10. Orientation views and resolutions belong to the same source photograph and count as **one** observation.

Standard preprocessing is EXIF orientation, bilinear shorter-side resize236/center-crop224, ImageNet normalization; the larger view uses resize354/crop336. The pretrained feature path retains ConvNeXt's normalization layer after spatial pooling, before its unused 1000-class head. Training and serving use identical transforms and feature concatenation order.

Five outer folds hold out photographs; three inner folds select view mode and C by balanced accuracy using only outer-training photos. All scaling and classifier fitting stay inside the relevant training partition. Selected outer query predictions give **258/303 = 85.1485% accuracy**, exceeding the requested 85% target. The outer fold correct counts are 51/61, 48/61, 52/61, 55/60 and 52/60. A separate three-fold full-collection validation chooses the installed combined-resolution classifier with C=1, followed by an all-photo fit. No training-set accuracy is presented as test accuracy.

The fixed 336px/C=1 candidate scored 262/303 (86.5%) in exploratory comparisons; that larger number is **not** substituted for the headline training-only selection score. Architecture exploration reused the entire collection, and sessions/near duplicates are unconfirmed. These scores remain an exploratory same-known-lot evaluation, not an independent external test or lab-measurement accuracy.

The earlier MobileNet fine-tuning trial was stopped after four completed outer folds and before activation. Even a perfect fifth fold could not exceed 238/303 (78.5%) for that selection procedure, below the completed ConvNeXt result. Its partial-trial record is retained locally (not published) in `models/quality/runs/20261014T094329306895Z/training_status.json`; no complete MobileNet aggregate is claimed.

`lot_backbone.pt` and `lot_classifier.npz` are hashed serving artifacts. `convnext_features.npz`, source hashes, exact inner/outer indices, predictions, class order, settings and full candidate comparisons remain with the immutable run. Serving export was checked on actual photos, and the property estimates were compared against the prior artifact to ensure they did not change. Old saved analyses retain their original matches and model versions.

## Artifacts and activation

Each immutable run is under `models/quality/runs/<UTC timestamp>/`:

- `artifact.json`: model/task versions, field order, encoder configuration, label fingerprint and file hashes.
- `backbone.pt`, optional `head.pt`, `parameters.npz`: serving weights and training normalization.
- `labels.json`: the exact lab reference snapshot used by this model.
- `references.npz`: one visual reference feature vector per lot.
- `manifest.json`, `features.npz`, `evaluation.json`: reproducibility evidence.

`--activate` atomically replaces `models/quality/active.json` only after training finishes. The service verifies contained paths, checksums, task versions, target order, normalization and reference shapes before loading. It never falls back to mock measurements. Set `QUALITY_MODEL_PATH` to another active pointer when needed. All artifact paths in the pointer are relative to its directory.

The active pointer now selects progressive run `20261016T053517996518Z`. Preserve its full bundle together with the pointer, the original checkpoints and their hash manifest when publishing. The original published baseline run `20261014T100934100536Z` remains available separately. Binary `.pt` and `.npz` files use Git LFS: install Git LFS before cloning, then run `git lfs pull` to restore actual weights rather than pointer text. The original lab PDF and photographs are included in `Lab Reports/`. Other generated model runs, download caches, incomplete trials, uploads and databases stay ignored. Running another machine still requires installing dependencies and applying migrations; pushing the repository does not deploy it.

For the local container stack, `INSTALL_ML=true docker compose up --build` installs quality inference dependencies. Models and the supplied Lab Reports folder are mounted read-only. `MODEL_MODE` may remain `mock` for the independent cultivar demonstration; quality analysis loads its own trained artifact.

## Application and API

The existing FastAPI storage/validation/authentication conventions are reused. The quality API does not require `MODEL_MODE=trained`: that setting belongs to the separate cultivar classifier.

- `GET /api/v1/quality/status`: readiness, actual model comparison, known-lot matching metrics, training protocol and limitations.
- `GET /api/v1/quality/references`: frozen report-average reference labels.
- `GET /api/v1/quality/report`: original PDF, checked against the digitized report hash.
- `POST /api/v1/quality/analyze`: multipart `file`; experimental estimates or withholding.
- `GET /api/v1/quality/analyses`: paginated quality history.
- `GET /api/v1/quality/analyses/{id}`: full immutable result snapshot.
- `GET /api/v1/quality/analyses/{id}/csv`: estimate values, units, statuses, error metrics and model version.
- `GET /api/v1/quality/analyses/{id}/reference.csv`: matched reference’s recorded lab averages and SD, frozen with the saved analysis. Withheld captures have no reference CSV.
- `DELETE /api/v1/quality/analyses/{id}`: delete the result and stored upload.

Apply `python -m alembic -c backend/alembic.ini upgrade head` for managed databases. Migration 0002 creates the separate `quality_analyses` table; existing cultivar prediction rows remain compatible. Development/test startup also creates missing tables.

Focus and exposure checks withhold poor captures. A conservative feature-distance heuristic withholds captures outside the reference envelope. Neither certifies cotton identity nor constitutes validated out-of-distribution detection. A closest visual reference is labelled as such and never asserted to be the photographed lot. Numeric estimates outside physical limits are withheld; unsupported grades that do not improve on the categorical baseline are withheld. Every response remains experimental even when capture checks pass.

The result table contains all numeric candidates plus categorical grades, Grade and Amt. Unsupported/unknown fields show their reason rather than invented values. After analysis, `/analyze?analysis={id}` displays the matched T label, photograph, recorded lab averages and SD, and a lab-profile CSV link on the same page. The recorded profile is the default tab; experimental estimates and their CSV are a separate tab. Reloading the URL restores the saved snapshot. The original full report is linked below. History stores the complete prediction and reference snapshot, so subsequent model or metadata changes do not rewrite old results.

Inference must finish before storage/persistence begins. Timeout cannot create a late saved result. A failed database write removes its uploaded image. The configured API key protects analysis and deletion consistently with the existing API. The existing web client does not collect API keys; authenticated deployments should use the established gateway/proxy auth arrangement.

## Verification and next data collection

```sh
python -m pytest tests -q
ruff check ml backend tests scripts
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

End-to-end quality checks use the real local model and a supplied cotton photograph, verify saved-result reload, reference separation, CSV and PDF access, and clean up their saved record. When no artifact is installed, the UI exposes a disabled training-required state rather than pretend measurements.

Collect more independently HVI-tested cotton lots with confirmed IDs, same-material photographs, lab and capture dates, device/session information and representative lighting/backgrounds. Retain new untouched lots for external evaluation. Agree per-property acceptable errors with the lab; use learning curves and external errors to decide dataset sufficiency. Adding photographs of the original ten lots does not establish broader physical accuracy.

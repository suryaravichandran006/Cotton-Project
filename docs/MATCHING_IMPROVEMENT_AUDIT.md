# Improving T1–T10 matching

## Completed upgrade

The installed ConvNeXt run `20261014T100934100536Z` achieved **258/303 = 85.1%** in five outer image folds with training-only selection of feature mode and regularization in three inner folds. The installed classifier uses concatenated 224px/336px frozen ImageNet ConvNeXt features and a trained balanced linear classifier. Original numeric-property regression weights and lab profiles are unchanged.

The requested 85% threshold is met in this exploratory same-known-lot image evaluation. Architecture exploration reused this collection; capture sessions, near duplicates and photo-to-lab provenance remain unconfirmed. This is not external/new-lot accuracy or lab-measurement accuracy. The prior exploratory results below are retained as investigation history, not the current installed score.

Full current protocol: [COTTON_QUALITY.md](COTTON_QUALITY.md). Current evidence: `models/quality/runs/20261014T100934100536Z/evaluation.json`.

## What the original displayed 53.1% measured

The original model bundle was `models/quality/runs/20261014T091053938572Z`. Its T-label matcher uses frozen ImageNet MobileNetV3-Small features and one average feature vector per source lot. The separate CNN–LSTM head estimates numeric properties; it does not learn T1–T10 as classes.

The 303 eligible loose-fibre images represent ten known physical lots with provisional photo-to-report mapping. T labels are lot IDs, not ten confirmed cotton cultivars. Identifying the closest known lot is different from determining the origin or lab properties of previously unseen cotton.

## Experiments on the existing features

All comparisons reused the active bundle’s fixed features and the same five stratified image folds (seed 42). A query photograph was excluded from its training fold. Feature scaling, where needed, was fitted on the training partition only. No original images, serving weights, active pointer or displayed score were changed.

| Matcher | Correct / 303 | Image-holdout accuracy |
| --- | ---: | ---: |
| Current cosine lot centroid | 161 | 53.1% |
| Cosine 1-nearest photograph | 192 | 63.4% |
| Cosine 3-nearest photographs, distance weighted | 193 | 63.7% |
| Cosine 5-nearest photographs, distance weighted | 192 | 63.4% |
| Spatial-feature nearest photograph | 198 | 65.3% |
| Standardized features + linear SVM | 229 | 75.6% |
| Standardized features + RBF SVM | 219 | 72.3% |
| Standardized features + logistic classifier | 233 | 76.9% |

These candidate scores are exploratory comparisons. The highest candidate score is not independent confirmation of the best selected model.

A nested comparison chose among the seven new candidates inside each outer training partition using three inner stratified folds and balanced accuracy. It achieved **232/303 = 76.6% accuracy**, **74.3% balanced accuracy**, and **74.8% macro F1** on the outer queries. The selected classifier varied across folds; this evaluates the selection procedure, rather than one final classifier. The outer fold accuracies were 73.8%, 68.9%, 77.0%, 86.7%, and 76.7%. One fold exceeding 85% does not establish 85% overall.

Further exploratory tests retained the whole spatial feature grid or combined feature means with standard deviations/maxima. Their accuracy ranged from 73.3% to 76.9%; none met 85%. These later comparisons do not extend the seven-candidate nested result.

Machine-readable evidence: `models/quality/matching-comparison.json` and `models/quality/matching-detail-comparison.json`. The first contains candidate metrics, nested training/test indices, selection scores, query predictions, truth, and the source artifact pointer.

## Changes with the strongest rationale

1. Train a dedicated T1–T10 classifier instead of matching only ten feature averages. The existing classifier experiments support this change. Use validation-selected regularization; deploy a full-training fit only after checking that serving preprocessing matches the evaluated method.
2. Fine-tune the later blocks of the pretrained CNN for this task, with a new ten-class head, a small learning rate, class-balanced training and validation-based stopping. This can adapt the visual features to cotton texture; its benefit still needs measurement. Increasing LSTM regression epochs alone does not directly train the T matcher.
3. Compare controlled close-up crops or higher resolution, preserving fibre texture. Generate training augmentations only after partitioning source photographs. Avoid strong colour transformations that could erase relevant differences.
4. Confirm each photo’s physical lot and lab mapping. Record capture sessions, remove/group near duplicates, and photograph the lots again under common lighting, distance and background. This reduces shortcuts based on camera/background rather than cotton.
5. Reserve fresh session-separated photographs from every known lot as an untouched final evaluation. For property estimation, separately reserve independently lab-tested new lots. Do not tune against either final test set.

At this earlier investigation stage, 85% remained a target and none of these overall experiments supported it. The completed upgrade above subsequently met it under the stated exploratory evaluation scope. Even a high same-lot image score would not validate new-lot origin identification or physical lab measurements. Numeric property estimates require acceptable MAE/RMSE in their actual units rather than a generic accuracy percentage.

Method references: [scikit-learn nested cross-validation](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html), [PyTorch transfer learning](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html).

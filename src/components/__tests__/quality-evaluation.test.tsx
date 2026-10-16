import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QualityEvaluation, QualityWorking } from "@/components/quality-evaluation";
import { qualityStatusSchema } from "@/lib/quality-types";

const fixture = qualityStatusSchema.parse({
  status: "ready", experimental: true, model: "cnn_lstm", version: "synthetic-fixture", label_status: "provisional_lot_average",
  independent_lots: 2, training_images: 8, selection_rule: "Synthetic fixture", evaluation_scope: "Synthetic fixture; not training evidence.",
  comparison: [{ model: "cnn_lstm", selected: true, validation_normalized_mae: 1.5, held_out_lot_count: 2, properties: {}, category_accuracy: {} }],
  matching: {
    evaluation_kind: "nested_image_cv", method: "Synthetic nested evaluation", scope: "Synthetic fixture; not real cotton evidence.",
    installed_name: "Trained fixture classifier", installed_model: "logistic_224", selection_rule: "Selection uses inner validation only.",
    accuracy: .75, balanced_accuracy: .75, macro_precision: .75, macro_recall: .75, macro_f1: .75,
    correct: 6, total: 8, fold_count: 2, labels: ["T1", "T2"], confusion_matrix: [[3, 1], [1, 3]],
    per_lot: { T1: { precision: .75, recall: .75, f1: .75, support: 4 }, T2: { precision: .75, recall: .75, f1: .75, support: 4 } },
    target_accuracy: .85, target_met: false,
    comparison: [{ model: "logistic_224", name: "Trained fixture classifier", accuracy: .9, balanced_accuracy: .9, macro_f1: .9, selected: true }],
  }, limitations: ["Synthetic UI fixture"], message: "Synthetic fixture",
});

describe("matching evaluation evidence", () => {
  it("explains actual progressive transfer without claiming the old independent encoders", () => {
    render(<QualityWorking status={{ ...fixture, protocol: { matching_encoder: "timm_convnext_tiny", transfer_learning: {
      route: "progressive", stages: ["ImageNet", "cotton leaves", "cotton seeds"], transferred_tensors: 180,
      source_checkpoint_sha256: "synthetic", exported_backbone_sha256: "synthetic",
    } } }} />);
    expect(screen.getByText(/ImageNet → cotton leaves → cotton seeds → cotton analysis/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progressive feature extraction" })).toBeInTheDocument();
    expect(screen.queryByText(/MobileNetV3/)).not.toBeInTheDocument();
    expect(screen.getByText(/old leaf and seed output layers are discarded/)).toBeInTheDocument();
  });
  it("keeps headline accuracy and its scope while removing the detailed comparisons", () => {
    render(<QualityEvaluation status={fixture} />);
    const headline = screen.getByText("Accuracy", { selector: "dt" }).parentElement!;
    expect(within(headline).getByText("75.0%")).toBeInTheDocument();
    expect(screen.queryByText(/Target: 85.0%/)).not.toBeInTheDocument();
    expect(screen.getByText(/headline score evaluates the training-only selection procedure/)).toBeInTheDocument();
    expect(screen.queryByText("90.0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/confusion matrix|Matching selection protocol|Training protocol and evidence limits/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Property error comparison|All numeric property results|Why this property model was selected/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Installed matcher: Trained fixture classifier/)).toBeInTheDocument();
  });
  it("does not claim trained matching or a target outcome for a legacy centroid artifact", () => {
    render(<QualityEvaluation status={{ ...fixture, matching: { ...fixture.matching!, evaluation_kind: undefined, installed_name: undefined, comparison: undefined, target_accuracy: undefined, target_met: undefined } }} />);
    expect(screen.getByText(/Reference centroids exclude each query photo/)).toBeInTheDocument();
    expect(screen.queryByText(/Installed matcher:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Target: 85.0%/)).not.toBeInTheDocument();
  });
});

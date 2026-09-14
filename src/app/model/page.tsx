import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/page-header";
import { ModelStatus } from "./model-status";

export const metadata: Metadata = { title: "Model & technology" };

const CANDIDATES = [
  { name: "ConvNeXt-Tiny", key: "convnext_tiny", role: "Primary candidate", why: "Modernised ConvNet with large-kernel depthwise convolutions; strong on texture-dominated imagery such as fibre lint." },
  { name: "EfficientNetV2-S", key: "efficientnetv2_s", role: "Strong alternative", why: "Compound-scaled network with a favourable accuracy/compute trade-off and fast training." },
  { name: "ResNet50", key: "resnet50", role: "Baseline", why: "The reference residual CNN. Well understood, easy to compare against published work." },
  { name: "MobileNetV3-Large", key: "mobilenetv3_large", role: "Mobile candidate", why: "Designed for on-device inference; needed for the planned mobile application and for gin/warehouse deployments without GPUs." },
];

const PIPELINE = [
  ["Preprocessing", "EXIF orientation fix → RGB → shorter side resized to the training resolution → centre crop → ImageNet mean/std normalisation. Identical in training evaluation and production."],
  ["Transfer learning", "All backbones start from ImageNet weights and are fine-tuned end-to-end with AdamW or SGD, cosine schedule with warm-up, label smoothing and optional class weights."],
  ["Calibration", "A single temperature T is fitted on validation logits by minimising NLL. Reported confidence is softmax(logits / T); arg-max (accuracy) is unchanged."],
  ["Unknown rejection", "If calibrated confidence is below a configurable threshold the API returns is_unknown=true. The rejector interface also supports energy scores and composite strategies."],
  ["Grad-CAM", "Gradients of the predicted class w.r.t. the last convolutional stage weight the activation maps; the result is upsampled and blended over the crop the model saw."],
  ["Registry", "models/registry.json records architecture, class names, image size, normalisation, temperature, OOD settings, metrics and git commit for every exported model. The API serves whichever entry is active."],
];

export default function ModelPage() {
  return (
    <>
      <PageHeader eyebrow="Model" title="Model & technology" description="What is currently being served, which architectures the training framework benchmarks, and how confidence is produced." />
      <Container className="space-y-12 py-8">
        <ModelStatus />

        <section aria-labelledby="candidates">
          <h2 id="candidates" className="text-lg font-semibold tracking-tight text-ink">
            Benchmark candidates
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            No architecture is assumed to be best. All four are trained with the same splits, augmentation and evaluation protocol; the winner is selected on
            macro-F1, per-class recall, calibration, latency and size (see docs/EXPERIMENTS.md).
          </p>
          <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Architecture</th>
                  <th className="px-4 py-2.5 font-medium">Config key</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {CANDIDATES.map((c) => (
                  <tr key={c.key} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{c.key}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.role}</td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{c.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Measured results are intentionally absent until the cotton dataset has been trained on; see docs/EXPERIMENTS.md for the result templates.</p>
        </section>

        <section aria-labelledby="pipeline">
          <h2 id="pipeline" className="text-lg font-semibold tracking-tight text-ink">
            Inference pipeline
          </h2>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            {PIPELINE.map(([title, text]) => (
              <div key={title} className="rounded-lg border border-line bg-surface p-5">
                <dt className="text-sm font-semibold text-ink">{title}</dt>
                <dd className="mt-1 text-sm leading-6 text-ink-soft">{text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>
    </>
  );
}

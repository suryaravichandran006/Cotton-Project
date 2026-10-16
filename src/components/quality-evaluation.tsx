"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { qualityModelName } from "@/lib/quality-api";
import type { QualityStatus } from "@/lib/quality-types";

const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;

export function QualityWorking({ status }: { status: QualityStatus }) {
  const matchingSizes = status.protocol.matching_resolutions ?? [status.protocol.matching_image_size ?? 224];
  const progressive = status.protocol.transfer_learning?.route === "progressive";
  return <section id="working" className="scroll-mt-24 border-t border-line pt-10" aria-labelledby="working-heading">
    <div className="max-w-3xl"><h2 id="working-heading" className="font-display text-3xl sm:text-4xl">How the analysis works</h2><p className="mt-3 text-base leading-7 text-ink-soft">{progressive ? "ImageNet → cotton leaves → cotton seeds → cotton analysis. The final tasks reuse the backbone learned during leaf and seed training." : "One photograph feeds two tasks: matching a known reference lot and estimating cotton properties."}</p></div>
    <div className="mt-7 grid items-center gap-4 lg:grid-cols-[1fr_auto_1.2fr_auto_1.5fr]">
      <div className="border-y border-line py-5"><h3 className="text-lg font-semibold">Cotton photograph</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Check focus and exposure, crop and normalize. Property input: 224 × 224; matching input: {matchingSizes.map((size) => `${size} × ${size}`).join(" + ")}.</p></div>
      <div className="flex justify-center text-accent" aria-hidden><ArrowRight className="hidden h-6 w-6 lg:block" /><ArrowDown className="h-6 w-6 lg:hidden" /></div>
      <div className="border-y border-line py-5"><h3 className="text-lg font-semibold">{progressive ? "Progressive feature extraction" : "CNN feature extraction"}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{progressive ? "ConvNeXt-Tiny carries the leaf → seed learning into both final tasks. Its backbone stays frozen while new cotton matching and property models are trained; the old leaf and seed output layers are discarded." : <>The property branch uses frozen ImageNet MobileNetV3-Small features. {status.protocol.matching_encoder === "convnext_tiny" ? "The matching branch uses a separate frozen ImageNet ConvNeXt-Tiny encoder and trained T-label classifier." : "The matching branch uses its own trained classifier when installed."}</>}</p></div>
      <div className="flex justify-center text-accent" aria-hidden><ArrowRight className="hidden h-6 w-6 lg:block" /><ArrowDown className="h-6 w-6 lg:hidden" /></div>
      <div className="divide-y divide-line border-y border-line">
        <div className="py-4"><h3 className="text-lg font-semibold">Reference matching → T1–T10</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{status.matching?.installed_name ? `${status.matching.installed_name} predicts a known T label. Retrieve that reference’s recorded lab averages.` : "Compare features with the known lot profiles. Retrieve that lot’s recorded lab averages."}</p></div>
        <div className="py-4"><h3 className="text-lg font-semibold">{qualityModelName(status.model ?? "")} → property estimates</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{status.model === "cnn_lstm" ? "An LSTM reads 16 spatial feature steps from this one photo, then the regression head estimates 13 numeric properties." : status.model === "mean" ? "The mean baseline was selected. These estimates are averages and do not depend on this photograph." : "The selected property model estimates numeric values from the image features."}</p></div>
      </div>
    </div>
    <p className="mt-5 max-w-3xl text-sm leading-6 text-ink-soft">The displayed lab profile comes from the matched reference report. The model-estimate tab contains separate experimental predictions.</p>
  </section>;
}

export function QualityEvaluation({ status }: { status: QualityStatus }) {
  const matching = status.matching;

  return <section id="model-results" className="scroll-mt-24 space-y-10 border-t border-line pt-10" aria-labelledby="evaluation-heading">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><h2 id="evaluation-heading" className="font-display text-3xl sm:text-4xl">Measured model results</h2><p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">{status.training_images} loose-fibre photos · {status.independent_lots} source lots · {qualityModelName(status.model ?? "")} selected for property estimation.</p></div><span className="text-sm font-semibold text-warn">Exploratory evaluation</span></div>

    {matching ? <div>
      <h3 className="text-xl font-semibold">Known-lot matching accuracy</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{matching.correct} of {matching.total} held-out photographs matched their T label in {matching.fold_count}-fold image evaluation. {matching.evaluation_kind === "nested_image_cv" ? "Classifier settings are chosen without the held-out query photos. The same physical lots appear on both sides." : "Reference centroids exclude each query photo, but the same physical lots appear on both sides."}</p>
      {matching.installed_name ? <p className="mt-3 text-sm font-semibold text-accent">Installed matcher: {matching.installed_name}</p> : null}
      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-line py-6 sm:grid-cols-3 xl:grid-cols-5">
        {([["Accuracy", matching.accuracy], ["Balanced accuracy", matching.balanced_accuracy], ["Macro precision", matching.macro_precision], ["Macro recall", matching.macro_recall], ["Macro F1", matching.macro_f1]] as const).map(([label, value]) => <div key={label}><dt className="text-sm text-ink-soft">{label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">{percentage(value)}</dd></div>)}
      </dl>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft">{matching.scope}</p>
      {matching.evaluation_kind === "nested_image_cv" ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">The headline score evaluates the training-only selection procedure across folds. The installed classifier is fitted on all available photos after selection; its training fit is not test evidence.</p> : null}
    </div> : <p className="text-sm text-ink-soft">Matching accuracy has not been evaluated for this installed model.</p>}
  </section>;
}

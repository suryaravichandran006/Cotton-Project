import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { StageResultsVisuals } from "@/components/stage-results-visuals";
import { formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Results" };

const resultCopy = {
  leaf: {
    stage: "Stage 1",
    title: "Cotton leaf adaptation",
    path: "ImageNet → Cotton leaves",
    summary: "2 errors",
    detail: "Both were Bacterial Blight images predicted as Verticillium Wilt.",
    href: "/models/leaf",
  },
  seed: {
    stage: "Stage 2",
    title: "Cotton seed adaptation",
    path: "Cotton leaves → Cotton seeds",
    summary: "3 errors",
    detail: "One Broken seed was predicted as Intact; two Intact seeds were predicted as Cracked.",
    href: "/models/seed",
  },
} as const;

export default function ResultsPage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">Results</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              Measured results from the completed stages.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              Leaf and seed models both learned their tasks successfully, and the checkpoint handoff between them was verified.
            </p>
          </div>
        </Container>
      </section>

      <ResultSection stageId="leaf" />

      <section className="border-y border-line bg-ink text-white">
        <Container className="py-14 sm:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-[#b7ddcc]">Leaf → Seed checkpoint transfer</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-white sm:text-5xl">
              The trained backbone moved forward.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/68">
              Leaf-trained features were retained, while the task-specific classifier was replaced for the seed task.
            </p>

            <dl className="mx-auto mt-9 grid max-w-4xl gap-6 sm:grid-cols-3">
              <TransferMetric value="180" label="Compatible tensors loaded" />
              <TransferMetric value="2" label="Head tensors replaced" />
              <TransferMetric value="0" label="Unexpected tensors" />
            </dl>
          </div>
        </Container>
      </section>

      <ResultSection stageId="seed" />

      <section className="border-t border-line bg-canvas">
        <Container className="py-16 text-center sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-semibold text-accent">Scientific boundary</p>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The pipeline is proven. The final hypothesis is not.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              These results verify the two intermediate stages. Only the final four-route experiment can show whether progressive transfer improves raw-cotton cultivar recognition.
            </p>
            <Link href="/analyze" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
              Continue to the final experiment <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

function ResultSection({ stageId }: { stageId: "leaf" | "seed" }) {
  const result = stageResultById(stageId);
  const content = resultCopy[stageId];

  return (
    <section className={stageId === "leaf" ? "bg-canvas" : "bg-surface"} aria-labelledby={`${stageId}-result`}>
      <Container className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-semibold text-accent">{content.stage} · Complete</p>
            <h2 id={`${stageId}-result`} className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              {content.title}
            </h2>
            <p className="mt-3 text-base font-semibold text-ink-soft">{content.path}</p>

            <dl className="mx-auto mt-9 grid max-w-3xl gap-6 sm:grid-cols-2">
              <ResultMetric value={formatPercent(result.test.macro_f1)} label="Test Macro-F1" />
              <ResultMetric value={String(result.test.correct) + " / " + String(result.test.samples)} label="Correct predictions" />
            </dl>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <StageResultsVisuals stageId={stageId} variant="matrix" />
          </div>

          <div className="mx-auto mt-7 flex max-w-4xl flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-6 py-5 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xl font-semibold text-ink">{content.summary}</p>
              <p className="mt-1 text-base leading-7 text-ink-soft">{content.detail}</p>
            </div>
            <Link href={content.href} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
              Detailed evidence <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ResultMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-line-strong pt-5 text-center">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="metric-tabular mt-2 text-5xl font-semibold tracking-[-0.04em] text-ink sm:text-6xl">{value}</dd>
    </div>
  );
}

function TransferMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-white/20 pt-5 text-center">
      <dt className="text-sm font-semibold text-white/60">{label}</dt>
      <dd className="metric-tabular mt-2 text-5xl font-semibold tracking-[-0.04em] text-white">{value}</dd>
    </div>
  );
}

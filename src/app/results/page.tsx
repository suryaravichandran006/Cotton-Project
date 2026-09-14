import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { StageResultsVisuals } from "@/components/stage-results-visuals";
import { formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Results" };

const resultCopy = {
  leaf: {
    stage: "Stage 01",
    title: "Cotton leaf adaptation",
    path: "ImageNet -> Cotton leaves",
    interpretation: "The selected checkpoint classified 167 of 169 held-out images correctly. Both errors were Bacterial Blight images predicted as Verticillium Wilt.",
    method: "ImageNet-pretrained ConvNeXt-Tiny; five-class temporary head; AdamW at 0.0002; 20 epochs.",
    calibration: "Validation ECE reduced from 8.52% to 0.22% after temperature scaling.",
    href: "/models/leaf",
  },
  seed: {
    stage: "Stage 02",
    title: "Cotton seed adaptation",
    path: "Cotton leaves -> Cotton seeds",
    interpretation: "The selected checkpoint classified 65 of 68 held-out images correctly. One Broken seed was predicted as Intact and two Intact seeds were predicted as Cracked.",
    method: "Leaf-initialized ConvNeXt-Tiny; three-class temporary head; AdamW at 0.00015; early stopping after epoch 17.",
    calibration: "Validation ECE reduced from 2.54% to 2.09% after temperature scaling.",
    href: "/models/seed",
  },
} as const;

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Interim testing & analysis"
        title="Measured evidence from the completed stages."
        description="Leaf and seed results show that both intermediate tasks trained successfully and that the progressive checkpoint handoff worked. They do not yet prove improvement on the final cultivar task."
      />

      <Container className="space-y-16 py-12 sm:py-16">
        <aside className="border-y border-line-strong py-5 text-sm leading-7 text-ink-soft">
          <strong className="font-semibold text-ink">How to read these results:</strong> each score belongs to a different temporary classification task, so leaf and seed percentages should not be ranked against each other. Their purpose is to verify learning and produce the next initialization checkpoint.
        </aside>

        <ResultStage stageId="leaf" />

        <section aria-labelledby="handoff-evidence" className="rounded-2xl bg-ink px-6 py-7 text-white sm:px-8">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Verified leaf-to-seed handoff</p>
              <h2 id="handoff-evidence" className="mt-2 text-2xl font-semibold">The seed run started from the trained leaf backbone.</h2>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <TransferStat label="Loaded" value="180 tensors" />
              <TransferStat label="Replaced" value="2 head tensors" />
              <TransferStat label="Unexpected" value="0 tensors" />
            </dl>
          </div>
        </section>

        <ResultStage stageId="seed" />

        <div className="flex justify-end">
          <Link href="/analyze" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
            Continue to the final stage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

function ResultStage({ stageId }: { stageId: "leaf" | "seed" }) {
  const result = stageResultById(stageId);
  const copy = resultCopy[stageId];

  return (
    <section aria-labelledby={`${stageId}-result`}>
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{copy.stage} complete</p>
          <h2 id={`${stageId}-result`} className="font-display mt-3 text-4xl leading-tight text-ink sm:text-5xl">{copy.title}</h2>
          <p className="mt-3 text-sm font-semibold text-ink-soft">{copy.path}</p>
        </div>

        <dl className="grid gap-5 border-t border-line-strong pt-5 sm:grid-cols-3">
          <ResultMetric label="Test Macro-F1" value={formatPercent(result.test.macro_f1)} />
          <ResultMetric label="Correct" value={`${result.test.correct} / ${result.test.samples}`} />
          <ResultMetric label="Best epoch" value={String(result.best_epoch)} />
        </dl>
      </div>

      <div className="mt-8">
        <StageResultsVisuals stageId={stageId} />
      </div>

      <div className="mt-6 grid gap-6 border-y border-line py-6 lg:grid-cols-[0.72fr_1.28fr]">
        <h3 className="text-base font-semibold text-ink">Interpretation</h3>
        <p className="text-sm leading-7 text-ink-soft">{copy.interpretation}</p>
      </div>

      <details className="mt-5 rounded-2xl border border-line bg-surface px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Technical details and limitation</summary>
        <div className="mt-5 grid gap-5 border-t border-line pt-5 text-sm leading-6 sm:grid-cols-2">
          <div><p className="font-semibold text-ink">Training</p><p className="mt-1 text-ink-soft">{copy.method}</p></div>
          <div><p className="font-semibold text-ink">Calibration</p><p className="mt-1 text-ink-soft">{copy.calibration}</p></div>
          <div><p className="font-semibold text-ink">Dataset split</p><p className="mt-1 text-ink-soft">{result.split.train} train / {result.split.val} validation / {result.split.test} test.</p></div>
          <div><p className="font-semibold text-ink">Evaluation boundary</p><p className="mt-1 text-ink-soft">{result.caveat}</p></div>
        </div>
        <Link href={copy.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">Open full per-class evidence <ArrowRight className="h-4 w-4" /></Link>
      </details>
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt><dd className="metric-tabular mt-2 text-3xl font-semibold text-ink">{value}</dd></div>;
}

function TransferStat({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-white/15 pt-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</dt><dd className="mt-2 text-lg font-semibold text-white">{value}</dd></div>;
}

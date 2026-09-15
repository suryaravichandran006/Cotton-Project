import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { PresentationMetric, ResearchBoundary, StatusBadge } from "@/components/presentation";
import { StageResultsVisuals } from "@/components/stage-results-visuals";
import { formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Results" };

const copy = {
  leaf: {
    label: "Cotton leaf adaptation",
    path: "ImageNet → Cotton leaves",
    interpretation: "167 of 169 held-out images were correct. Both errors were Bacterial Blight images predicted as Verticillium Wilt.",
    href: "/models/leaf",
  },
  seed: {
    label: "Cotton seed adaptation",
    path: "Cotton leaves → Cotton seeds",
    interpretation: "65 of 68 held-out images were correct: one Broken seed was predicted as Intact, and two Intact seeds as Cracked.",
    href: "/models/seed",
  },
} as const;

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Interim results"
        title="Two completed stages. Two measured checkpoints."
        description="Each result verifies a temporary training task and produces the checkpoint used by the next stage."
      />

      <Container className="space-y-20 py-14 sm:py-18">
        <ResearchBoundary title="These results do not answer the final hypothesis">
          Leaf and seed percentages belong to different temporary classification tasks. They validate the intermediate pipeline; only a same-data comparison of the four final routes can measure the value of progressive transfer.
        </ResearchBoundary>

        <ResultStage stageId="leaf" />

        <section aria-labelledby="handoff" className="rounded-2xl bg-ink px-6 py-8 text-white shadow-lift sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-[#b7ddcc]">Verified leaf-to-seed handoff</p>
              <h2 id="handoff" className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">The trained backbone moved forward. The leaf classifier did not.</h2>
            </div>
            <dl className="grid gap-5 sm:grid-cols-3">
              <PresentationMetric value="180" label="Tensors loaded" inverse />
              <PresentationMetric value="2" label="Head tensors replaced" inverse />
              <PresentationMetric value="0" label="Unexpected tensors" inverse />
            </dl>
          </div>
        </section>

        <ResultStage stageId="seed" />

        <div className="flex justify-end border-t border-line pt-8">
          <Link href="/analyze" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
            Continue to the final stage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

function ResultStage({ stageId }: { stageId: "leaf" | "seed" }) {
  const result = stageResultById(stageId);
  const content = copy[stageId];

  return (
    <section aria-labelledby={`${stageId}-title`} className="grid gap-9 border-t border-line-strong pt-9 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
      <div>
        <StatusBadge>Stage {stageId === "leaf" ? "1" : "2"} complete</StatusBadge>
        <h2 id={`${stageId}-title`} className="font-display mt-5 text-4xl leading-tight text-ink sm:text-5xl">{content.label}</h2>
        <p className="mt-3 text-sm font-semibold text-accent">{content.path}</p>
        <dl className="mt-8 grid gap-5 sm:grid-cols-2">
          <PresentationMetric value={formatPercent(result.test.macro_f1)} label="Test Macro-F1" />
          <PresentationMetric value={`${result.test.correct} / ${result.test.samples}`} label="Correct predictions" />
        </dl>
        <p className="mt-7 max-w-xl text-base leading-7 text-ink-soft">{content.interpretation}</p>
        <Link href={content.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
          Open detailed stage evidence <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <StageResultsVisuals stageId={stageId} variant="matrix" />
    </section>
  );
}

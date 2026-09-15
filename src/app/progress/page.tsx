import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { StatusBadge } from "@/components/presentation";
import { datasetById, EXPERIMENT_ROUTES, formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  const leaf = stageResultById("leaf");
  const seed = stageResultById("seed");
  const leafData = datasetById("leaf");
  const seedData = datasetById("seed");

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <StatusBadge>Current state</StatusBadge>
            <h1 className="font-display mx-auto mt-5 max-w-4xl text-6xl leading-[0.94] text-ink sm:text-7xl lg:text-[5.5rem]">
              2 of 3 stages complete.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
              Leaf and seed training are complete. The final raw-cotton experiment is still pending.
            </p>

            <ol className="mx-auto mt-12 grid max-w-4xl gap-3 text-left" aria-label="Research stage completion">
              <Stage number="01" title="Cotton leaf adaptation" status="Complete" />
              <ArrowDown className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
              <Stage number="02" title="Cotton seed adaptation" status="Complete" />
              <ArrowDown className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
              <Stage number="03" title="Raw cotton grade study" status="Pending" pending />
            </ol>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Completed stage outputs</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              What the completed stages produced.
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <StageOutput
                stage="Stage 1"
                title="Cotton leaf adaptation"
                score={formatPercent(leaf.test.macro_f1)}
                correct={String(leaf.test.correct) + " / " + String(leaf.test.samples)}
                note="Best checkpoint saved and used to initialize the seed stage."
              />
              <StageOutput
                stage="Stage 2"
                title="Cotton seed adaptation"
                score={formatPercent(seed.test.macro_f1)}
                correct={String(seed.test.correct) + " / " + String(seed.test.samples)}
                note="Leaf-trained features transferred successfully; seed checkpoint saved for the final stage."
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Ready for the final experiment</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The foundation for the final comparison is in place.
            </h2>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <ReadinessCard
                value={String(leafData.used_images ?? leafData.images) + " + " + String(seedData.used_images ?? seedData.images)}
                title="Audited training data"
                detail="Leaf and seed datasets are cleaned, split and already used in completed training runs."
              />
              <ReadinessCard
                value="180 · 2 · 0"
                title="Verified checkpoint handoff"
                detail="180 tensors loaded, 2 task-head tensors replaced and 0 unexpected tensors."
              />
              <ReadinessCard
                value={String(EXPERIMENT_ROUTES.length) + " routes"}
                title="Controlled final comparison"
                detail="Every route will use the same final data, backbone and evaluation protocol."
              />
            </div>

            <div className="mt-12 flex justify-center border-t border-line pt-8">
              <Link href="/architecture" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
                See how the stages connect <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function Stage({
  number,
  title,
  status,
  pending = false,
}: {
  number: string;
  title: string;
  status: string;
  pending?: boolean;
}) {
  return (
    <li
      className={
        pending
          ? "grid gap-4 rounded-2xl border border-gold/30 bg-gold-soft px-6 py-6 sm:grid-cols-[56px_1fr_auto] sm:items-center"
          : "grid gap-4 rounded-2xl border border-line bg-canvas px-6 py-6 sm:grid-cols-[56px_1fr_auto] sm:items-center"
      }
    >
      <span className="font-mono text-xs text-ink-muted">{number}</span>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <StatusBadge state={pending ? "pending" : "complete"}>{status}</StatusBadge>
    </li>
  );
}

function StageOutput({
  stage,
  title,
  score,
  correct,
  note,
}: {
  stage: string;
  title: string;
  score: string;
  correct: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-7 text-left shadow-card">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-accent">{stage}</p>
        <StatusBadge>Complete</StatusBadge>
      </div>

      <h3 className="mt-5 text-2xl font-semibold text-ink">{title}</h3>

      <dl className="mt-7 grid gap-5 sm:grid-cols-2">
        <div className="border-t border-line-strong pt-4">
          <dt className="text-sm font-semibold text-ink-muted">Test Macro-F1</dt>
          <dd className="metric-tabular mt-2 text-4xl font-semibold tracking-[-0.035em] text-ink">{score}</dd>
        </div>
        <div className="border-t border-line-strong pt-4">
          <dt className="text-sm font-semibold text-ink-muted">Correct predictions</dt>
          <dd className="metric-tabular mt-2 text-4xl font-semibold tracking-[-0.035em] text-ink">{correct}</dd>
        </div>
      </dl>

      <p className="mt-6 text-base leading-7 text-ink-soft">{note}</p>
    </article>
  );
}

function ReadinessCard({
  value,
  title,
  detail,
}: {
  value: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-canvas p-6 text-left shadow-card sm:p-7">
      <p className="metric-tabular text-3xl font-semibold tracking-[-0.03em] text-accent">{value}</p>
      <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base leading-7 text-ink-soft">{detail}</p>
    </article>
  );
}

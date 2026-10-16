import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { StatusBadge } from "@/components/presentation";
import { datasetById, EXPERIMENT_ROUTES, formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Progress" };

const remainingSteps = [
  ["01", "Get final dataset", "Confirm access, labels and provenance."],
  ["02", "Prepare final split", "Group images from the same specimen together."],
  ["03", "Train 4 routes", "Use the same backbone, split and evaluation protocol."],
  ["04", "Compare and select", "Choose using final-test Macro-F1 and supporting metrics."],
] as const;

export default function ProgressPage() {
  const leaf = stageResultById("leaf");
  const seed = stageResultById("seed");
  const leafData = datasetById("leaf");

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Stages</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-6xl leading-[0.94] text-ink sm:text-7xl lg:text-[5.5rem]">
              2 of 3 stages complete.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
              Leaf and seed adaptation are complete. The final raw-cotton grade experiment is next.
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
            <p className="text-sm font-semibold text-accent">What’s completed</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The intermediate pipeline is fully working.
            </h2>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <CompletedCard
                value={formatPercent(leaf.test.macro_f1)}
                title="Leaf model complete"
                detail={String(leaf.test.correct) + " / " + String(leaf.test.samples) + " held-out images classified correctly."}
              />
              <CompletedCard
                value={formatPercent(seed.test.macro_f1)}
                title="Seed model complete"
                detail={String(seed.test.correct) + " / " + String(seed.test.samples) + " held-out images classified correctly."}
              />
              <CompletedCard
                value={String(leafData.images) + " → " + String(leafData.used_images ?? leafData.images)}
                title="Leaf dataset cleaned"
                detail="Duplicates and conflicting labels removed before splitting."
              />
              <CompletedCard
                value="180 · 2 · 0"
                title="Checkpoint transfer verified"
                detail="180 tensors loaded, 2 task-head tensors replaced, 0 unexpected tensors."
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">What’s left</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              One final controlled experiment.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              The remaining work is focused: prepare the raw-cotton dataset, train the four planned routes and compare them fairly.
            </p>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
              {remainingSteps.map(([number, title, detail]) => (
                <article key={number} className="rounded-2xl border border-line bg-canvas p-6 text-left">
                  <span className="font-mono text-xs text-ink-muted">{number}</span>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-base leading-7 text-ink-soft">{detail}</p>
                </article>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-3xl text-base leading-7 text-ink-soft">
              {EXPERIMENT_ROUTES.length} routes will be tested. No route is treated as the winner before the final evidence exists.
            </p>

            <Link href="/final-stage" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
              Open final stage <ArrowRight className="h-4 w-4" />
            </Link>
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

function CompletedCard({
  value,
  title,
  detail,
}: {
  value: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-7 text-left shadow-card">
      <p className="metric-tabular text-4xl font-semibold tracking-[-0.035em] text-accent">{value}</p>
      <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base leading-7 text-ink-soft">{detail}</p>
    </article>
  );
}

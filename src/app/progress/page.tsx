import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { Container } from "@/components/page-header";
import { StatusBadge } from "@/components/presentation";

export const metadata: Metadata = { title: "Progress" };

const completedWork = [
  ["Dataset ready", "Audited data + fixed splits"],
  ["Training pipeline", "ImageNet → Leaf → Seed"],
  ["Evaluation ready", "Macro-F1 + confusion matrices"],
  ["Transfer verified", "180 tensors transferred"],
] as const;

const evidence = [
  {
    measure: "1,373 → 1,124",
    title: "Leaf data cleaned",
    detail: "Duplicates and conflicting labels removed before splitting.",
  },
  {
    measure: "180 + 2",
    title: "Checkpoint transfer verified",
    detail: "180 compatible tensors kept; 2 task-head tensors replaced.",
  },
  {
    measure: "Grouped final split",
    title: "Stronger final evaluation",
    detail: "Final cotton samples will be grouped to reduce leakage risk.",
  },
] as const;

export default function ProgressPage() {
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
              <Stage number="03" title="Raw cotton cultivar study" status="Pending" pending />
            </ol>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Completed work</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The full intermediate pipeline is working.
            </h2>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {completedWork.map(([title, detail]) => (
                <article key={title} className="rounded-2xl border border-line bg-surface p-6 text-left shadow-card">
                  <div className="flex items-center gap-2 text-accent">
                    <Check className="h-4 w-4" aria-hidden />
                    <span className="text-sm font-semibold">Complete</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-base leading-7 text-ink-soft">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Evidence of refinement</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The implementation was tested and improved.
            </h2>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {evidence.map((item) => (
                <article key={item.title} className="rounded-2xl border border-line bg-canvas p-6 text-left shadow-card sm:p-7">
                  <p className="metric-tabular text-3xl font-semibold tracking-[-0.025em] text-accent">{item.measure}</p>
                  <h3 className="mt-5 text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-base leading-7 text-ink-soft">{item.detail}</p>
                </article>
              ))}
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

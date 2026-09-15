import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { Container } from "@/components/page-header";
import { SectionIntro, StatusBadge } from "@/components/presentation";

export const metadata: Metadata = { title: "Progress" };

const checkpoints = [
  ["Dataset Pipeline", "Audits, cleaning and fixed split manifests"],
  ["Progressive Training", "ImageNet to leaves, then leaf checkpoint to seeds"],
  ["Evaluation Pipeline", "Macro-F1, per-class analysis and confusion matrices"],
  ["Checkpoint Transfer", "Shape-safe backbone loading with recorded handoff"],
] as const;

const refinements = [
  { measure: "1,373 → 1,124", title: "Duplicate-safe leaf data", detail: "Exact duplicates and conflicting labels were removed before split creation." },
  { measure: "180 kept · 2 replaced", title: "Shape-safe checkpoint transfer", detail: "Compatible backbone tensors moved forward; the task-specific head was rebuilt." },
  { measure: "Image-level → grouped", title: "Stronger final evaluation", detail: "Intermediate results disclose missing specimen IDs; the final study will group physical samples." },
] as const;

export default function ProgressPage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-14 sm:py-18 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <StatusBadge>Current state</StatusBadge>
            <h1 className="font-display mt-5 text-6xl leading-[0.92] text-ink sm:text-7xl lg:text-[5.5rem]">2 of 3 stages complete.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-ink-soft">The working pipeline has reached cotton seeds. The final raw-cotton comparison remains pending.</p>
          </div>

          <ol className="grid gap-3" aria-label="Research stage completion">
            <Stage number="01" title="Cotton leaf adaptation" detail="Audited, trained and evaluated" status="Complete" />
            <ArrowDown className="ml-8 h-5 w-5 text-ink-muted" aria-hidden />
            <Stage number="02" title="Cotton seed adaptation" detail="Transferred, trained and evaluated" status="Complete" />
            <ArrowDown className="ml-8 h-5 w-5 text-ink-muted" aria-hidden />
            <Stage number="03" title="Raw cotton cultivar study" detail="Dataset access and controlled comparison" status="Pending" pending />
          </ol>
        </Container>
      </section>

      <Container className="space-y-20 py-14 sm:py-18">
        <section aria-labelledby="implemented">
          <SectionIntro title="The implementation backbone is working." body="Four completed modules now support the final controlled experiment." />
          <div className="mt-9 grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {checkpoints.map(([title, detail]) => (
              <article key={title} className="border-t border-line-strong pt-5">
                <div className="flex items-center gap-2 text-accent"><Check className="h-4 w-4" /><span className="text-xs font-semibold">Complete</span></div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="refined">
          <SectionIntro title="Three problems made the method stronger." body="Each refinement changed the implementation or the way its evidence is reported." />
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {refinements.map((item) => (
              <article key={item.title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <p className="metric-tabular text-2xl font-semibold tracking-[-0.025em] text-accent">{item.measure}</p>
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="flex justify-end border-t border-line pt-8">
          <Link href="/architecture" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
            See how the stages connect <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

function Stage({ number, title, detail, status, pending = false }: { number: string; title: string; detail: string; status: string; pending?: boolean }) {
  return (
    <li className={pending ? "grid gap-4 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-5 sm:grid-cols-[48px_1fr_auto] sm:items-center" : "grid gap-4 rounded-2xl border border-line bg-canvas px-5 py-5 sm:grid-cols-[48px_1fr_auto] sm:items-center"}>
      <span className="font-mono text-xs text-ink-muted">{number}</span>
      <div><h2 className="text-lg font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-ink-soft">{detail}</p></div>
      <StatusBadge state={pending ? "pending" : "complete"}>{status}</StatusBadge>
    </li>
  );
}

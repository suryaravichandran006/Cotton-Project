/*
THESIS: Cotton Grade opens as a research review grounded in an accessible photo-identification use case.
OWN-WORLD: Preserve the restrained cotton-green, paper-white and research-report visual language.
STORY: State the practical problem, show what is complete, prove the checkpoint handoff, then organize the implementation evidence.
FIRST VIEWPORT: Practical project purpose on the left; a compact vertical stage-status ledger on the right; project sections follow below.
FORM: A concise academic briefing sequence inside the established Cotton Grade visual system.
*/

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";

const projectSections = [
  ["Progress", "What has been implemented and refined", "/progress"],
  ["Architecture", "How data and checkpoints move between stages", "/architecture"],
  ["Data & Method", "Datasets, processing and training protocol", "/datasets"],
  ["Results", "Measured leaf and seed evidence", "/results"],
  ["Final Stage", "Pending dataset, controlled routes and next work", "/analyze"],
] as const;

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-12 py-14 sm:py-20 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Review 3
            </p>
            <h1 className="font-display mt-5 max-w-4xl text-5xl leading-[0.96] text-ink sm:text-6xl lg:text-7xl">
              Identify raw cotton from one simple photograph.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft">
              Cotton Grade is being developed for small cotton and textile retailers who need an accessible way to identify the raw cotton they handle without specialist equipment.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/progress" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
                Review current progress <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/architecture" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-line-strong">
                Open architecture
              </Link>
            </div>
          </div>

          <aside className="overflow-hidden rounded-2xl bg-ink text-white shadow-lift" aria-label="Current research state">
            <div className="border-b border-white/10 px-6 py-5 sm:px-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Current research state</p>
              <p className="mt-2 text-xl font-semibold">Two intermediate stages complete</p>
            </div>
            <div className="divide-y divide-white/10">
              <StageState number="01" title="Cotton leaf adaptation" detail="98.80% test Macro-F1" status="Complete" />
              <StageState number="02" title="Cotton seed adaptation" detail="95.61% test Macro-F1" status="Complete" />
              <StageState number="03" title="Raw cotton cultivar model" detail="Dataset access and training pending" status="Pending" pending />
            </div>
            <p className="border-t border-white/10 px-6 py-5 text-sm leading-6 text-white/60 sm:px-7">
              Intermediate success proves the training and transfer pipeline works. It does not yet prove the final photo-identification goal.
            </p>
          </aside>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Research question</p>
              <h2 className="font-display mt-3 text-4xl leading-tight text-ink sm:text-5xl">
                Can a small retailer identify raw cotton cultivar from a single photograph?
              </h2>
            </div>
            <div className="border-t border-line-strong pt-6 lg:mt-3">
              <p className="max-w-3xl text-base leading-8 text-ink-soft">
                The intended system accepts an ordinary RGB photograph and returns a predicted cultivar. The research tests whether progressive learning through cotton leaves and seeds can make that final photo-based identification more reliable than direct ImageNet transfer.
              </p>
              <dl className="mt-8 grid gap-6 sm:grid-cols-3">
                <Evidence label="Leaf dataset" value="1,124" detail="training-ready images after cleaning" />
                <Evidence label="Seed dataset" value="450" detail="audited images across three classes" />
                <Evidence label="Verified handoff" value="180" detail="compatible tensors transferred" />
              </dl>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Project sections</p>
            <h2 className="font-display mt-3 text-4xl text-ink sm:text-5xl">Implementation, method and results.</h2>
            <p className="mt-4 text-base leading-7 text-ink-soft">Completed work is separated from the final stage that is still pending.</p>
          </div>

          <ol className="mt-9 divide-y divide-line border-y border-line">
            {projectSections.map(([title, detail, href], index) => (
              <li key={href}>
                <Link href={href} className="group grid gap-2 py-5 transition sm:grid-cols-[48px_180px_1fr_auto] sm:items-center">
                  <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-semibold text-ink">{title}</span>
                  <span className="text-sm text-ink-soft">{detail}</span>
                  <ArrowRight className="hidden h-4 w-4 text-accent transition group-hover:translate-x-1 sm:block" />
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}

function StageState({ number, title, detail, status, pending = false }: { number: string; title: string; detail: string; status: string; pending?: boolean }) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] gap-4 px-6 py-5 sm:px-7">
      <span className="font-mono text-xs text-white/35">{number}</span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/50">{detail}</p>
      </div>
      <span className={pending ? "text-xs font-semibold text-[#e8c995]" : "text-xs font-semibold text-[#b7ddcc]"}>{status}</span>
    </div>
  );
}

function Evidence({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="metric-tabular mt-2 text-3xl font-semibold text-ink">{value}</dd>
      <dd className="mt-1 text-sm leading-5 text-ink-soft">{detail}</dd>
    </div>
  );
}

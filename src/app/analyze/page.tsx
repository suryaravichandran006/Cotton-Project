import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Container } from "@/components/page-header";
import { FlowSequence, PresentationMetric, ResearchBoundary, SectionIntro, StatusBadge } from "@/components/presentation";
import { DATASETS, EXPERIMENT_ROUTES } from "@/lib/research";

export const metadata: Metadata = { title: "Final Stage · WIP" };

const remaining = [
  { title: "Acquire", detail: "confirm licence + provenance", tone: "gold" as const },
  { title: "Audit", detail: "validate + group samples", tone: "rose" as const },
  { title: "Train 4 routes", detail: "same split + protocol", tone: "blue" as const },
  { title: "Compare", detail: "untouched test set", tone: "violet" as const },
  { title: "Select", detail: "best supported model", tone: "green" as const },
];

export default function FinalStagePage() {
  const finalDataset = DATASETS.find((dataset) => dataset.id === "final");

  return (
    <>
      <section className="bg-ink text-white">
        <Container className="grid gap-10 py-14 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e8c995]">Final cultivar experiment / Pending dataset access</p>
            <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[0.96] text-white sm:text-6xl lg:text-7xl">The decisive experiment has not started.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">The plan is ready. Final claims and deployment wait for dataset access, specimen-safe preparation and a fair four-route comparison.</p>
          </div>
          <dl className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <PresentationMetric value="~3,447" label="Candidate images" inverse />
            <PresentationMetric value="5" label="Cultivars" inverse />
            <PresentationMetric value="0" label="Final results" detail="intentionally unavailable" inverse />
          </dl>
        </Container>
      </section>

      <Container className="space-y-20 py-14 sm:py-18">
        <section aria-labelledby="routes">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionIntro title="Four routes will answer one question." body="Architecture, final dataset split, image size and evaluation protocol stay fixed. Only the initialization path changes." />
            <a href={finalDataset?.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-strong">
              Candidate dataset source <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {EXPERIMENT_ROUTES.map((route, index) => (
              <article key={route.id} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-xs text-ink-muted">R{index + 1}</p>
                  <StatusBadge state={index === 3 ? "proposed" : "pending"}>{index === 3 ? "Proposed progressive route" : "Planned"}</StatusBadge>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">{route.label}</h3>
                <p className="mt-4 text-base font-semibold leading-7 text-accent">{route.path.join(" → ")}</p>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{route.question}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="remaining-flow">
          <SectionIntro title="From dataset access to model selection." body="No route is declared the winner before this sequence is complete." />
          <FlowSequence steps={remaining} className="mt-9" />
        </section>

        <ResearchBoundary title="The decision rule is fixed before results exist">
          Primary selection uses Macro-F1 on the untouched final test set. Balanced accuracy, worst-class recall, calibration, inference efficiency and model size provide supporting evidence. A direct-transfer win or a negative-transfer result remains scientifically valid.
        </ResearchBoundary>
      </Container>
    </>
  );
}

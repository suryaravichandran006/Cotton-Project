import Link from "next/link";

import type { ArchitectureViewModel } from "@/components/architecture/architecture-data";
import { ArchitectureNode } from "@/components/architecture/ArchitectureNode";
import { HorizontalConnector, VerticalConnector } from "@/components/architecture/connectors";

type FinalExperimentData = ArchitectureViewModel["finalExperiment"];

export function FinalExperiment({ experiment }: { experiment: FinalExperimentData }) {
  return (
    <article data-architecture-section aria-labelledby="final-experiment-title" className="overflow-hidden rounded-xl border-2 border-[#202923] bg-[#fbfaf6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#202923] bg-[#dcecf5] px-5 py-3 sm:px-6">
        <h2 id="final-experiment-title" className="text-xl font-black uppercase leading-tight tracking-[-0.025em] text-[#111915] sm:text-2xl">
          Final Cotton Experiment
        </h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[#786b3d] bg-[#fff8d8] px-2.5 py-1 text-xs font-bold text-[#645728]">{experiment.datasetStatus}</span>
          <Link href="/experiments" className="text-sm font-semibold text-[#26372e] underline decoration-[#6a8175] underline-offset-4 hover:text-accent">
            View experiment design
          </Link>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 sm:py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-[#526057]">
          <p>{experiment.datasetDetail}</p>
          <p>{experiment.classCount} candidate cultivars</p>
        </div>

        <div className="grid items-stretch lg:grid-cols-[minmax(280px,1fr)_88px_minmax(235px,0.84fr)_58px_minmax(220px,0.75fr)]">
          <div className="grid gap-3" aria-label="Controlled transfer routes">
            {experiment.routes.map((route) => (
              <div key={route.id} className="rounded-lg border-2 border-[#493139] bg-[#f8dfe5] px-4 py-3 shadow-[0_3px_0_rgba(28,37,32,0.06)]">
                <p className="text-base font-extrabold leading-tight text-[#18211c]">{route.label}</p>
                <p className="mt-1 text-sm font-medium leading-5 text-[#4a3a3f]">{route.path}</p>
              </div>
            ))}
          </div>

          <RouteConvergence />

          <div className="flex items-center">
            <ArchitectureNode
              title="Same final dataset"
              detail="Same ConvNeXt-Tiny · Same evaluation"
              tone="model"
              className="min-h-[126px]"
            />
          </div>

          <HorizontalConnector className="mx-2 self-center" />
          <VerticalConnector className="lg:hidden" />

          <div className="flex items-center">
            <ArchitectureNode
              title="Best route will be selected"
              detail="Highest held-out Macro-F1"
              tone="output"
              className="min-h-[126px]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function RouteConvergence() {
  return (
    <div className="relative min-h-14 lg:min-h-0" aria-hidden>
      <VerticalConnector className="lg:hidden" />
      <svg className="absolute inset-0 hidden h-full w-full overflow-visible lg:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" fill="#202923" />
          </marker>
        </defs>
        <path d="M0 12.5 H45 V50 H96" fill="none" stroke="#202923" strokeWidth="2" vectorEffect="non-scaling-stroke" markerEnd="url(#route-arrow)" />
        <path d="M0 37.5 H45" fill="none" stroke="#202923" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d="M0 62.5 H45" fill="none" stroke="#202923" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d="M0 87.5 H45 V50" fill="none" stroke="#202923" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

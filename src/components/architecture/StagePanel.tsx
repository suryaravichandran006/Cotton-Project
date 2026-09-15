import Link from "next/link";

import type { ArchitectureStage } from "@/components/architecture/architecture-data";
import { ArchitectureNode } from "@/components/architecture/ArchitectureNode";
import { HorizontalConnector, VerticalConnector } from "@/components/architecture/connectors";

export function StagePanel({ stage }: { stage: ArchitectureStage }) {
  return (
    <article
      data-architecture-section
      data-receiver={stage.id}
      aria-labelledby={`${stage.id}-stage-title`}
      className="relative overflow-hidden rounded-xl border-2 border-[#202923] bg-[#fbfaf6]"
    >
      <span data-receiver-edge aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-[#245b47] opacity-0" />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#202923] bg-[#dcecf5] px-5 py-3 sm:px-6">
        <h2 id={`${stage.id}-stage-title`} className="text-xl font-black uppercase leading-tight tracking-[-0.025em] text-[#111915] sm:text-2xl">
          Stage {stage.number} · {stage.title}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#245b47]">{stage.status}</span>
          <Link href={stage.href} className="text-sm font-semibold text-[#26372e] underline decoration-[#6a8175] underline-offset-4 hover:text-accent">
            View evidence
          </Link>
        </div>
      </header>

      <div className="grid gap-3 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)_48px_minmax(0,1fr)_48px_minmax(0,1fr)] lg:items-center lg:gap-0">
        {stage.nodes.map((node, index) => (
          <div key={`${stage.id}-${node.kind}`} className="contents">
            <ArchitectureNode title={node.title} detail={node.detail} tone={node.kind} />
            {index < stage.nodes.length - 1 ? (
              <>
                <VerticalConnector className="lg:hidden" />
                <HorizontalConnector className="mx-2" />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

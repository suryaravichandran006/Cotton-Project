import Link from "next/link";

import { ArchitectureNode, type ArchitectureNodeTone } from "@/components/architecture/ArchitectureNode";
import { HorizontalConnector, VerticalConnector } from "@/components/architecture/connectors";

const productionNodes: Array<{ title: string; detail?: string; tone: ArchitectureNodeTone }> = [
  { title: "Cotton Photo", tone: "dataset" },
  { title: "FastAPI", tone: "service" },
  { title: "Final Model", tone: "model" },
  { title: "Cultivar + Confidence", tone: "output" },
  { title: "Web / Mobile", tone: "service" },
];

export function ProductionFlow() {
  return (
    <section data-architecture-section aria-labelledby="production-title" className="overflow-hidden rounded-xl border-2 border-[#202923] bg-[#fbfaf6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#202923] bg-[#dcecf5] px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="production-title" className="text-xl font-black uppercase leading-tight tracking-[-0.025em] text-[#111915] sm:text-2xl">Production Inference</h2>
          <span className="rounded-full border border-[#786b3d] bg-[#fff8d8] px-2.5 py-1 text-xs font-bold text-[#645728]">Planned</span>
        </div>
        <Link href="/analyze" className="text-sm font-semibold text-[#26372e] underline decoration-[#6a8175] underline-offset-4 hover:text-accent">View final-stage status</Link>
      </header>

      <div className="grid gap-3 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_42px_minmax(0,0.86fr)_42px_minmax(0,1fr)_42px_minmax(0,1.18fr)_42px_minmax(0,1fr)] lg:items-center lg:gap-0">
        {productionNodes.map((node, index) => (
          <div key={node.title} className="contents">
            <ArchitectureNode {...node} className="min-h-[82px]" />
            {index < productionNodes.length - 1 ? (
              <>
                <VerticalConnector className="h-11 lg:hidden" />
                <HorizontalConnector className="mx-2" />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

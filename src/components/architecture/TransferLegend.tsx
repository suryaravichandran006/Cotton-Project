import { ArchitectureNode } from "@/components/architecture/ArchitectureNode";
import { HorizontalConnector } from "@/components/architecture/connectors";

export function TransferLegend() {
  return (
    <aside aria-labelledby="transfer-legend-title" className="rounded-xl border-2 border-dashed border-[#39443d] bg-[#fffefa] p-4 sm:p-5">
      <h2 id="transfer-legend-title" className="text-lg font-extrabold tracking-[-0.02em] text-[#172019]">What is transferred?</h2>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_36px_auto] items-center gap-2">
          <ArchitectureNode title="Backbone" tone="model" className="min-h-[54px] px-3 py-2" />
          <HorizontalConnector className="flex lg:flex" />
          <span className="text-sm font-black text-[#245b47]">KEEP</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_36px_auto] items-center gap-2">
          <ArchitectureNode title="Classifier Head" tone="dataset" className="min-h-[54px] px-3 py-2" />
          <HorizontalConnector className="flex lg:flex" />
          <span className="text-sm font-black text-[#7d3849]">REPLACE</span>
        </div>
      </div>
    </aside>
  );
}

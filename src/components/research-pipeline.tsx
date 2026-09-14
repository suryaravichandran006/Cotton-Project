import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Database, Layers3, Microscope, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATASETS, TRAINING_STAGES, datasetById, formatCount } from "@/lib/research";

const ICONS = {
  leaf: Microscope,
  seed: Layers3,
  final: ScanSearch,
} as const;

export function ResearchPipeline({ compact = false }: { compact?: boolean }) {
  const nodes = [
    { id: "imagenet", kicker: "Starting point", title: "ImageNet-1K", body: "Generic pretrained visual features", muted: true, icon: CircleDashed, href: undefined },
    ...TRAINING_STAGES.map((stage) => {
      const dataset = datasetById(stage.dataset_id);
      return {
        id: stage.id,
        kicker: stage.label,
        title: stage.title,
        body: `${dataset.name} · ${formatCount(dataset.images)} images`,
        muted: false,
        icon: ICONS[stage.id as keyof typeof ICONS] ?? Database,
        href: stage.id === "leaf" ? "/models/leaf" : stage.id === "seed" ? "/models/seed" : "/analyze",
      };
    }),
  ];

  return (
    <div className={cn("relative grid gap-3", compact ? "md:grid-cols-4" : "lg:grid-cols-4")}>
      {nodes.map((node, index) => (
        <div key={node.id} className="relative">
          <PipelineNode {...node} index={index} />
          {index < nodes.length - 1 ? <div className="pointer-events-none absolute left-1/2 top-full z-10 hidden h-3 w-px bg-line lg:block" aria-hidden /> : null}
        </div>
      ))}
    </div>
  );
}

function PipelineNode({ kicker, title, body, muted = false, icon: Icon, href, index }: { kicker: string; title: string; body: string; muted?: boolean; icon: typeof Database; href?: string; index: number }) {
  const content = (
    <div className={cn("group relative h-full overflow-hidden rounded-xl border p-4 transition sm:p-5", muted ? "border-line bg-surface-muted/35" : "border-line bg-surface hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-card")}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[9px] tracking-[0.16em] text-ink-muted">0{index}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-full border", muted ? "border-line bg-surface text-ink-muted" : "border-accent/15 bg-accent-soft text-accent")}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
      </div>
      <p className="mt-7 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">{kicker}</p>
      <h3 className="mt-2 text-sm font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 text-[10px] leading-4 text-ink-muted">{body}</p>
      {href ? <ArrowRight className="mt-4 h-3.5 w-3.5 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" aria-hidden /> : null}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function DatasetStrip() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {DATASETS.map((dataset) => (
        <article key={dataset.id} className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-accent">STAGE {dataset.stage}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{dataset.access.replace("_", " ")}</span>
          </div>
          <h3 className="font-display mt-4 text-2xl tracking-tight text-ink">{dataset.name}</h3>
          <p className="mt-1 text-sm text-ink-soft">{dataset.domain}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div><dt className="text-[10px] uppercase tracking-wide text-ink-muted">Images</dt><dd className="metric-tabular mt-1 text-base font-semibold text-ink">{formatCount(dataset.images)}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wide text-ink-muted">Labels</dt><dd className="metric-tabular mt-1 text-base font-semibold text-ink">{dataset.classes}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function TransferRule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div><h3 className="text-sm font-semibold text-ink">{title}</h3><div className="mt-1 text-sm leading-6 text-ink-soft">{children}</div></div>
    </div>
  );
}

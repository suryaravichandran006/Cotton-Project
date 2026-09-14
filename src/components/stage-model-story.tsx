import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, Database, Leaf, RefreshCw, Sprout, TriangleAlert } from "lucide-react";
import { StageResultsVisuals } from "@/components/stage-results-visuals";
import { Container, PageHeader } from "@/components/page-header";
import { datasetById, formatCount, formatPercent, stageResultById } from "@/lib/research";

const COPY = {
  leaf: {
    eyebrow: "Stage 01 · Complete",
    title: "Cotton leaf adaptation",
    description: "ImageNet → cotton leaves. This stage moves a generic ConvNeXt-Tiny backbone into a real cotton visual domain before any seed or fibre training.",
    icon: Leaf,
    why: "Cotton leaves expose the model to cotton-specific morphology, lesions, discoloration and fine surface texture. The temporary five-class disease / health head is useful only for this training stage.",
    init: "ImageNet-1K pretrained ConvNeXt-Tiny",
    head: "5-class leaf disease / health head",
    transfer: "Best leaf checkpoint becomes the initialization for the seed stage.",
    nextHref: "/models/seed",
    nextLabel: "Continue to seed stage",
  },
  seed: {
    eyebrow: "Stage 02 · Complete",
    title: "Cotton seed adaptation",
    description: "Cotton leaves → cotton seeds. The second stage starts from the trained leaf backbone and specializes it toward compact structures, cracks, boundaries and material texture.",
    icon: Sprout,
    why: "The seed labels are not cultivar labels. Their purpose is representation learning: forcing the backbone to model local cotton texture and small structural changes before final fibre training.",
    init: "Best leaf-stage ConvNeXt-Tiny checkpoint",
    head: "3-class broken / cracked / intact head",
    transfer: "180 compatible tensors transferred from leaf → seed; two task-head tensors were skipped and replaced.",
    nextHref: "/analyze",
    nextLabel: "Open final cotton workspace",
  },
} as const;

export function StageModelStory({ stageId }: { stageId: keyof typeof COPY }) {
  const copy = COPY[stageId];
  const dataset = datasetById(stageId);
  const result = stageResultById(stageId);
  const Icon = copy.icon;

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <Container className="space-y-16 py-14 sm:py-16">
        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-[1.75rem] bg-ink p-7 text-white sm:p-8">
            <Icon className="h-6 w-6 text-white/70" />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Why this stage?</p>
            <p className="font-display mt-4 text-3xl leading-tight sm:text-4xl">{copy.why}</p>
          </article>

          <article className="rounded-[1.75rem] border border-line bg-surface p-7 sm:p-8">
            <div className="flex items-center gap-2 text-accent"><Database className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Dataset & split</span></div>
            <h2 className="font-display mt-4 text-3xl text-ink">{dataset.name}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SmallStat label="Training-ready" value={formatCount(result.training_ready_images)} />
              <SmallStat label="Classes" value={String(dataset.classes)} />
              <SmallStat label="Train / val / test" value={`${result.split.train} / ${result.split.val} / ${result.split.test}`} />
            </div>
            <p className="mt-6 text-sm leading-7 text-ink-soft">{dataset.source_scope}</p>
          </article>
        </section>

        <section>
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Training setup</p>
            <h2 className="font-display mt-3 text-4xl text-ink">What we actually trained.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Setup icon={BrainCircuit} label="Initialization" value={copy.init} />
            <Setup icon={RefreshCw} label="Temporary task head" value={copy.head} />
            <Setup icon={CheckCircle2} label="Checkpoint handoff" value={copy.transfer} />
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Held-out results</p>
              <h2 className="font-display mt-3 text-4xl text-ink">Stage {stageId === "leaf" ? "01" : "02"} performance.</h2>
            </div>
            <p className="text-sm text-ink-muted">Best validation checkpoint · epoch {result.best_epoch}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BigMetric label="Test Macro-F1" value={formatPercent(result.test.macro_f1)} primary />
            <BigMetric label="Accuracy" value={formatPercent(result.test.accuracy)} />
            <BigMetric label="Balanced accuracy" value={formatPercent(result.test.balanced_accuracy)} />
            <BigMetric label="Correct" value={`${result.test.correct} / ${result.test.samples}`} />
          </div>

          <div className="mt-6"><StageResultsVisuals stageId={stageId} /></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-6 py-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Per-class test performance</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-canvas text-[10px] uppercase tracking-[0.12em] text-ink-muted"><tr><th className="px-6 py-3">Class</th><th className="px-4 py-3">Precision</th><th className="px-4 py-3">Recall</th><th className="px-4 py-3">F1</th><th className="px-4 py-3">Support</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {result.per_class.map((row) => <tr key={row.name}><td className="px-6 py-3 font-semibold text-ink">{row.name}</td><td className="px-4 py-3">{formatPercent(row.precision)}</td><td className="px-4 py-3">{formatPercent(row.recall)}</td><td className="px-4 py-3">{formatPercent(row.f1)}</td><td className="px-4 py-3">{row.support}</td></tr>)}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="rounded-2xl border border-gold/20 bg-gold-soft p-6">
            <TriangleAlert className="h-5 w-5 text-gold" />
            <h3 className="mt-5 text-lg font-semibold text-ink">Evaluation limitation</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{result.caveat}</p>
          </aside>
        </section>

        <div className="flex justify-end"><Link href={copy.nextHref} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">{copy.nextLabel} <ArrowRight className="h-4 w-4" /></Link></div>
      </Container>
    </>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-canvas p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p><p className="metric-tabular mt-2 text-xl font-semibold text-ink">{value}</p></div>;
}

function Setup({ icon: Icon, label, value }: { icon: typeof BrainCircuit; label: string; value: string }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><Icon className="h-5 w-5 text-accent" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p></article>;
}

function BigMetric({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return <div className={primary ? "rounded-2xl bg-accent p-6 text-white" : "rounded-2xl border border-line bg-surface p-6"}><p className={primary ? "text-xs font-semibold uppercase tracking-[0.12em] text-white/65" : "text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"}>{label}</p><p className={`metric-tabular mt-3 text-4xl font-semibold ${primary ? "text-white" : "text-ink"}`}>{value}</p></div>;
}

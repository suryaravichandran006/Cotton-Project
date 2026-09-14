import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, Gauge, Sigma, TriangleAlert } from "lucide-react";
import { Container, PageHeader } from "@/components/page-header";
import { ExperimentResults } from "@/components/experiment-results";
import { EXPERIMENT_ROUTES, RESEARCH, STAGE_RESULTS, formatPercent } from "@/lib/research";

export const metadata: Metadata = { title: "Experiments" };

export default function ExperimentsPage() {
  return (
    <>
      <PageHeader eyebrow="Results & experiments" title="Two transfer stages are now backed by real evidence." description="Leaf and seed adaptation have completed with held-out test reports. Final raw-cotton route comparison remains pending until the cultivar dataset is available." />
      <Container className="space-y-16 py-12">
        <section>
          <div className="mb-7 grid gap-4 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Completed intermediate stages</p><h2 className="font-display mt-3 text-4xl text-ink">Measured results, not mock metrics.</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-ink-soft lg:justify-self-end">These results verify that both intermediate tasks trained successfully and that the leaf checkpoint transferred into the seed stage. They do not yet answer the final research question; that requires the raw-cotton comparison routes.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {STAGE_RESULTS.map((result, index) => (
              <article key={result.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <div className="flex items-start justify-between gap-4 border-b border-line p-6">
                  <div><div className="flex items-center gap-2 text-accent"><CheckCircle2 className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Stage 0{index + 1} complete</span></div><h3 className="font-display mt-3 text-3xl text-ink">{result.id === "leaf" ? "ImageNet → Cotton Leaves" : "Leaves → Cotton Seeds"}</h3><p className="mt-2 text-xs text-ink-muted">{result.architecture} · best epoch {result.best_epoch}</p></div>
                  <span className="rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">real run</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-line">
                  <MiniMetric label="Macro-F1" value={formatPercent(result.test.macro_f1)} />
                  <MiniMetric label="Accuracy" value={formatPercent(result.test.accuracy)} />
                  <MiniMetric label="Balanced acc." value={formatPercent(result.test.balanced_accuracy)} />
                </div>
                <div className="border-t border-line p-5 text-xs leading-6 text-ink-soft">
                  Held-out test: <strong className="text-ink">{result.test.correct}/{result.test.samples} correct</strong> · split {result.split.train}/{result.split.val}/{result.split.test}.
                  {result.id === "seed" && " 180 compatible tensors transferred from the leaf checkpoint; two task-head tensors were skipped."}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-gold/20 bg-gold-soft p-5"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><p className="text-xs leading-6 text-ink-soft"><strong className="text-ink">Scope:</strong> both public intermediate datasets lack specimen identifiers, so these are transparently reported as image-level held-out evaluations. The final cultivar study will use the strongest available specimen-safe protocol.</p></div>
        </section>

        <section>
          <div className="mb-7 grid gap-4 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Final controlled routes · pending</p><h2 className="font-display mt-3 text-4xl text-ink">A fair race between four initialization strategies.</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-ink-soft lg:justify-self-end">Architecture, final dataset split and evaluation protocol stay fixed. Only the path taken before final raw-cotton fine-tuning changes.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {EXPERIMENT_ROUTES.map((route, index) => (
              <article key={route.id} className="grid gap-5 border-b border-line p-6 last:border-b-0 lg:grid-cols-[72px_220px_1fr] lg:items-center">
                <div className="flex items-center gap-3 lg:block"><span className="font-display text-3xl text-accent/35">0{index + 1}</span><FlaskConical className="h-4 w-4 text-accent lg:mt-4" /></div>
                <div><p className="text-sm font-semibold text-ink">{route.label}</p><p className="mt-2 text-xs leading-5 text-ink-muted">{route.question}</p></div>
                <div className="flex flex-wrap items-center gap-2">{route.path.map((node, nodeIndex) => <span key={`${route.id}-${node}`} className="contents"><span className={nodeIndex === route.path.length - 1 ? "rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white" : node === "Leaves" || node === "Seeds" ? "rounded-full border border-gold/20 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-ink" : "rounded-full border border-line bg-surface-muted/55 px-3 py-1.5 text-xs font-medium text-ink-soft"}>{node}</span>{nodeIndex < route.path.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-ink-muted" /> : null}</span>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Final-stage report ingestion</p><h2 className="font-display mt-3 text-4xl text-ink">Final-task comparison</h2></div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] text-ink-muted"><Sigma className="h-3.5 w-3.5 text-accent" /> Primary metric · {RESEARCH.evaluation.primary_metric.replace("_", "-")}</div>
          </div>
          <ExperimentResults />
          <p className="mt-4 max-w-3xl text-xs leading-5 text-ink-muted">This panel remains intentionally empty until final raw-cotton reports exist. Calibration is fitted on validation data only; the final test set is never used for threshold tuning or model selection.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.78fr]">
          <article className="paper-field relative overflow-hidden rounded-2xl border border-line bg-surface p-7 shadow-card">
            <div className="soft-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />
            <div className="relative">
              <div className="flex items-center gap-2 text-accent"><Gauge className="h-4 w-4" /><p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Planned data-efficiency study</p></div>
              <h2 className="font-display mt-4 max-w-2xl text-4xl leading-tight text-ink">Can progressive transfer reach strong final performance with less labelled fibre?</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">The direct baseline and full progressive route will be retrained with reduced fractions of the final training set. This tests whether cotton-specific pre-adaptation makes each labelled fibre specimen more valuable.</p>
              <div className="mt-7 grid grid-cols-4 gap-3">{RESEARCH.evaluation.data_efficiency_fractions.map((fraction) => <div key={fraction} className="rounded-xl border border-line bg-surface/80 p-4 text-center"><span className="metric-tabular text-2xl font-semibold text-ink">{Math.round(fraction * 100)}%</span><span className="mt-1 block text-[9px] uppercase tracking-wide text-ink-muted">final train data</span></div>)}</div>
            </div>
          </article>
          <aside className="rounded-2xl bg-ink p-7 text-white shadow-lift">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Final decision rule</p>
            <h3 className="font-display mt-4 text-3xl leading-tight">The winning transfer route will not be chosen by accuracy alone.</h3>
            <div className="mt-6 space-y-3 text-sm text-white/65">
              {["Macro-F1 and balanced accuracy", "Worst-class recall", "Calibration / ECE", "Inference latency and model size", "Stability across data fractions"].map((item) => <div key={item} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">{item}</div>)}
            </div>
          </aside>
        </section>

        <div className="flex justify-end"><Link href="/analyze" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-px hover:shadow-card">Final model & live analyzer <ArrowRight className="h-4 w-4" /></Link></div>
      </Container>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="p-5"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p><p className="metric-tabular mt-2 text-2xl font-semibold text-ink">{value}</p></div>;
}

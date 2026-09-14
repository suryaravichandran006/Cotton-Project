import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { DATASETS, EXPERIMENT_ROUTES } from "@/lib/research";

export const metadata: Metadata = { title: "Final Stage · WIP" };

const nextSteps = [
  ["Obtain and verify the dataset", "Confirm access, licence, cultivar labels and specimen provenance."],
  ["Audit and create one shared split", "Remove invalid data and group images from the same physical specimen together."],
  ["Train four controlled routes", "Keep architecture, split, image size and evaluation protocol fixed across every route."],
  ["Evaluate and select the final model", "Compare Macro-F1, balanced accuracy, worst-class recall, calibration and efficiency."],
] as const;

export default function FinalStagePage() {
  const finalDataset = DATASETS.find((dataset) => dataset.id === "final");

  return (
    <>
      <PageHeader
        eyebrow="Final stage · Work in progress"
        title="What remains before cultivar classification."
        description="The final stage is planned but not presented as complete. Dataset access, specimen-safe preparation and the controlled comparison must happen before a deployable model can be selected."
      />

      <Container className="space-y-16 py-12 sm:py-16">
        <section aria-labelledby="final-status">
          <h2 id="final-status" className="sr-only">Final stage status</h2>
          <dl className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3">
            <Status label="Dataset access" value="Pending" active />
            <Status label="Final model training" value="Not started" />
            <Status label="Final results" value="Not available" />
          </dl>
        </section>

        <section aria-labelledby="target-dataset" className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Candidate target dataset</p>
            <h2 id="target-dataset" className="font-display mt-3 text-4xl leading-tight text-ink">CATGO Egyptian cotton fibre dataset.</h2>
            <a href={finalDataset?.source_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">Open source publication <ExternalLink className="h-4 w-4" /></a>
          </div>

          <div className="border-t border-line-strong pt-6">
            <p className="max-w-3xl text-base leading-8 text-ink-soft">The candidate dataset contains approximately 3,447 RGB images of raw or ginned cotton fibre across five Giza cultivars. It is the final target domain, not another temporary representation-learning task.</p>
            <dl className="mt-7 grid gap-5 sm:grid-cols-3">
              <TargetStat label="Images" value="3,447" />
              <TargetStat label="Cultivars" value="5" />
              <TargetStat label="Current state" value="Access pending" />
            </dl>
          </div>
        </section>

        <section aria-labelledby="remaining-work" className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Remaining work</p>
            <h2 id="remaining-work" className="font-display mt-3 text-4xl leading-tight text-ink">A clear path from access to evidence.</h2>
          </div>

          <ol className="relative border-l border-line-strong pl-7">
            {nextSteps.map(([title, detail], index) => (
              <li key={title} className="relative border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
                <span aria-hidden className="absolute -left-[33px] top-6 h-2.5 w-2.5 rounded-full bg-gold first:top-1" />
                <div className="grid gap-2 sm:grid-cols-[44px_1fr]">
                  <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3 className="text-sm font-semibold text-ink">{title}</h3><p className="mt-1 text-sm leading-6 text-ink-soft">{detail}</p></div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="final-routes" className="border-t border-line-strong pt-12">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Controlled experiment</p>
            <h2 id="final-routes" className="font-display mt-3 text-4xl text-ink sm:text-5xl">Four routes, one final test set.</h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">These routes test whether either intermediate domain, or the complete sequence, improves final cultivar recognition.</p>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
            {EXPERIMENT_ROUTES.map((route, index) => (
              <article key={route.id} className="grid gap-3 border-b border-line px-5 py-5 last:border-b-0 md:grid-cols-[54px_180px_1fr] md:items-center md:px-6">
                <span className="font-mono text-xs text-ink-muted">R{index + 1}</span>
                <div><h3 className="text-sm font-semibold text-ink">{route.label}</h3><p className="mt-1 text-xs text-ink-muted">{route.question}</p></div>
                <p className="text-sm font-semibold leading-6 text-accent">{route.path.join(" -> ")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-ink px-6 py-8 text-white sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Decision rule</p><h2 className="mt-2 text-2xl font-semibold">The winning route is selected from final evidence.</h2></div>
            <p className="text-sm leading-7 text-white/65">Primary selection uses Macro-F1 on the untouched final test set, supported by balanced accuracy, worst-class recall, calibration, inference latency and model size. A direct-transfer win or negative-transfer result remains scientifically valid.</p>
          </div>
        </section>
      </Container>
    </>
  );
}

function Status({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return <div className={active ? "bg-gold-soft px-6 py-5" : "border-t border-line px-6 py-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"}><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt><dd className={active ? "mt-2 text-xl font-semibold text-gold" : "mt-2 text-xl font-semibold text-ink"}>{value}</dd></div>;
}

function TargetStat({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-line pt-4"><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt><dd className="metric-tabular mt-2 text-2xl font-semibold text-ink">{value}</dd></div>;
}

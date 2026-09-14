import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { DATASETS, formatCount } from "@/lib/research";

export const metadata: Metadata = { title: "Data & Method" };

const classes: Record<string, string> = {
  leaf: "Five leaf disease and health classes",
  seed: "Broken, cracked and intact seed",
  final: "Five cotton cultivars",
};

const processingSteps = [
  ["Audit", "Validate files and inspect corruption, exact duplicates and conflicting labels."],
  ["Clean", "Remove confirmed duplicate copies and ambiguous cross-class groups before splitting."],
  ["Split", "Create reproducible train, validation and test manifests with seed 42."],
  ["Augment", "Apply augmentation only inside the training loader after split assignment."],
  ["Train", "Fine-tune ConvNeXt-Tiny and select the best checkpoint using validation Macro-F1."],
  ["Evaluate", "Use the held-out test set once for metrics, class errors and the confusion matrix."],
] as const;

const protocol = [
  ["Architecture", "ConvNeXt-Tiny"],
  ["Input", "224 x 224 RGB"],
  ["Optimizer", "AdamW"],
  ["Batch size", "32"],
  ["Training budget", "20 epochs per intermediate stage"],
  ["Checkpoint selection", "Validation Macro-F1"],
  ["Reproducibility", "Seed 42 with deterministic execution"],
  ["Primary test metric", "Macro-F1"],
] as const;

export default function DataMethodPage() {
  return (
    <>
      <PageHeader
        eyebrow="Data & method"
        title="Three datasets, one controlled processing method."
        description="Leaves and seeds teach temporary intermediate tasks. Raw cotton fibre is the final cultivar-classification domain."
      />

      <Container className="space-y-16 py-12 sm:py-16">
        <section aria-labelledby="dataset-role">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Dataset role</p>
            <h2 id="dataset-role" className="font-display mt-3 text-4xl text-ink sm:text-5xl">Each domain has a different job.</h2>
          </div>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {DATASETS.map((dataset) => {
              const complete = dataset.status === "trained";
              return (
                <article key={dataset.id} id={dataset.id} className="grid gap-5 py-7 lg:grid-cols-[86px_1.2fr_0.9fr_auto] lg:items-start">
                  <div>
                    <p className="font-mono text-xs text-ink-muted">STAGE 0{dataset.stage}</p>
                    <p className={complete ? "mt-2 text-xs font-semibold text-accent" : "mt-2 text-xs font-semibold text-gold"}>{complete ? "Trained" : "Pending"}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-accent">{dataset.domain}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">{dataset.name}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">{dataset.purpose}</p>
                  </div>

                  <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4 lg:border-t-0 lg:pt-0">
                    <DataStat label="Source" value={formatCount(dataset.images)} />
                    <DataStat label="Used" value={dataset.used_images ? formatCount(dataset.used_images) : "Pending"} />
                    <DataStat label="Classes" value={String(dataset.classes)} />
                    <div className="col-span-3 text-xs leading-5 text-ink-muted">{classes[dataset.id]}</div>
                  </dl>

                  <a href={dataset.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    Source <ExternalLink className="h-4 w-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="processing-method" className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Processing method</p>
            <h2 id="processing-method" className="font-display mt-3 text-4xl leading-tight text-ink">The same disciplined path for every stage.</h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">The final dataset adds specimen-aware grouping so multiple photographs of one physical sample cannot cross partitions.</p>
          </div>

          <ol className="relative border-l border-line-strong pl-7">
            {processingSteps.map(([title, detail], index) => (
              <li key={title} className="relative border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
                <span aria-hidden className="absolute -left-[33px] top-6 h-2.5 w-2.5 rounded-full bg-accent first:top-1" />
                <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                  <div className="flex items-baseline gap-3"><span className="font-mono text-[10px] text-ink-muted">{String(index + 1).padStart(2, "0")}</span><h3 className="text-sm font-semibold text-ink">{title}</h3></div>
                  <p className="text-sm leading-6 text-ink-soft">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="training-protocol" className="border-t border-line-strong pt-12">
          <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Training protocol</p>
              <h2 id="training-protocol" className="font-display mt-3 text-4xl leading-tight text-ink">Only the parameters needed to understand the run.</h2>
            </div>
            <dl className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2">
              {protocol.map(([label, value]) => (
                <div key={label} className="border-b border-line px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
                  <dd className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <aside className="rounded-2xl bg-gold-soft px-6 py-5 text-sm leading-7 text-ink-soft">
          <strong className="font-semibold text-ink">Evaluation boundary:</strong> the public leaf and seed datasets do not include specimen identifiers. Their scores are therefore reported as image-level held-out results. The final cultivar study will use grouped specimen splitting wherever provenance permits.
        </aside>

        <div className="flex justify-end">
          <Link href="/results" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
            Review measured results <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

function DataStat({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-muted">{label}</dt><dd className="metric-tabular mt-1 text-lg font-semibold text-ink">{value}</dd></div>;
}

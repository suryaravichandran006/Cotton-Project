import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { datasetById, formatCount } from "@/lib/research";

export const metadata: Metadata = { title: "Method" };

const trainingSteps = [
  ["Audit", "Remove duplicates and invalid data"],
  ["Split", "Create fixed train, validation and test sets"],
  ["Resize", "Convert images to 224 × 224 RGB"],
  ["Augment", "Apply augmentation to training images only"],
  ["Train & evaluate", "Fine-tune ConvNeXt-Tiny and measure Macro-F1"],
] as const;

export default function MethodPage() {
  const leaf = datasetById("leaf");
  const seed = datasetById("seed");
  const finalDataset = datasetById("final");

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">Method</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              How we prepare and train the model.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              The method is kept consistent across stages so the final comparison is fair.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Data used</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The model moves from general vision to cotton-specific data.
            </h2>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <DataCard
                label="Stage 1"
                title="Cotton leaves"
                value={formatCount(leaf.used_images ?? leaf.images)}
                detail={String(leaf.classes) + " classes"}
                status="Complete"
              />
              <DataCard
                label="Stage 2"
                title="Cotton seeds"
                value={formatCount(seed.used_images ?? seed.images)}
                detail={String(seed.classes) + " classes"}
                status="Complete"
              />
              <DataCard
                label="Final stage"
                title="Raw cotton fibre"
                value={"~" + formatCount(finalDataset.images)}
                detail={String(finalDataset.classes) + " cultivars"}
                status="Pending"
                pending
              />
            </div>

            <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-ink-soft">
              ConvNeXt-Tiny starts from ImageNet-pretrained weights, then adapts through the cotton datasets stage by stage.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Training method</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              One controlled pipeline for every stage.
            </h2>

            <ol className="mx-auto mt-10 grid max-w-5xl gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
              {trainingSteps.map(([title, detail], index) => (
                <li key={title} className="contents">
                  <div className="flex min-h-36 flex-col justify-center rounded-2xl border border-line bg-canvas px-5 py-5 text-center">
                    <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{detail}</p>
                  </div>
                  {index < trainingSteps.length - 1 ? (
                    <div className="grid place-items-center text-ink-muted" aria-hidden>
                      <ArrowDown className="h-5 w-5 lg:hidden" />
                      <ArrowRight className="hidden h-5 w-5 lg:block" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <dl className="mx-auto mt-10 grid max-w-4xl gap-5 border-y border-line py-7 sm:grid-cols-2 lg:grid-cols-4">
              <MethodStat label="Backbone" value="ConvNeXt-Tiny" />
              <MethodStat label="Input" value="224 × 224 RGB" />
              <MethodStat label="Optimizer" value="AdamW" />
              <MethodStat label="Primary metric" value="Macro-F1" />
            </dl>

            <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-ink-soft">
              For the final study, images from the same physical specimen will stay in the same split wherever provenance allows.
            </p>

            <div className="mt-10 flex justify-center">
              <Link href="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
                Review measured results <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function DataCard({
  label,
  title,
  value,
  detail,
  status,
  pending = false,
}: {
  label: string;
  title: string;
  value: string;
  detail: string;
  status: string;
  pending?: boolean;
}) {
  return (
    <article className={pending ? "rounded-2xl border border-gold/30 bg-gold-soft p-6 text-left" : "rounded-2xl border border-line bg-surface p-6 text-left shadow-card"}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink-muted">{label}</p>
        <span className={pending ? "text-sm font-semibold text-gold-strong" : "text-sm font-semibold text-accent"}>
          {status}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
      <p className="metric-tabular mt-4 text-4xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-2 text-base text-ink-soft">{detail}</p>
    </article>
  );
}

function MethodStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-2 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

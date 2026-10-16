import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, Leaf, RefreshCw, Sprout } from "lucide-react";

import { Container } from "@/components/page-header";
import { StageResultsVisuals } from "@/components/stage-results-visuals";
import { StatusBadge } from "@/components/presentation";
import { datasetById, formatCount, formatPercent, stageResultById } from "@/lib/research";

const COPY = {
  leaf: {
    stage: "Stage 01",
    title: "Cotton leaf adaptation",
    path: "ImageNet → Cotton leaves",
    summary: "The first stage moves ConvNeXt-Tiny from general ImageNet features into a cotton-specific visual domain.",
    why: "Leaves give the backbone its first exposure to cotton-specific shape, texture and disease patterns before seed and fibre training.",
    icon: Leaf,
    init: "ImageNet-1K pretrained ConvNeXt-Tiny",
    head: "5-class leaf disease / health head",
    handoff: "Best leaf checkpoint initializes the seed stage.",
    nextHref: "/models/seed",
    nextLabel: "Continue to seed stage",
  },
  seed: {
    stage: "Stage 02",
    title: "Cotton seed adaptation",
    path: "Cotton leaves → Cotton seeds",
    summary: "The second stage starts from the trained leaf backbone and adapts it to a different cotton domain.",
    why: "Seeds add compact structures, cracks, boundaries and surface texture before the final raw-cotton task.",
    icon: Sprout,
    init: "Best leaf-stage ConvNeXt-Tiny checkpoint",
    head: "3-class broken / cracked / intact head",
    handoff: "180 compatible tensors transferred; 2 task-head tensors replaced.",
    nextHref: "/final-stage",
    nextLabel: "Continue to final stage",
  },
} as const;

export function StageModelStory({ stageId }: { stageId: keyof typeof COPY }) {
  const copy = COPY[stageId];
  const dataset = datasetById(stageId);
  const result = stageResultById(stageId);
  const Icon = copy.icon;

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="flex justify-center">
              <StatusBadge>{copy.stage} · Complete</StatusBadge>
            </div>
            <h1 className="font-display mx-auto mt-5 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-4 text-base font-semibold text-accent">{copy.path}</p>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              {copy.summary}
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <Icon className="mx-auto h-6 w-6 text-accent" aria-hidden />
            <p className="mt-4 text-sm font-semibold text-accent">Why this stage?</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              {copy.why}
            </h2>

            <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
              <StageCard
                icon={Database}
                label="Dataset"
                title={dataset.name}
                detail={formatCount(result.training_ready_images) + " images · " + String(dataset.classes) + " classes"}
              />
              <StageCard
                icon={RefreshCw}
                label="Temporary task"
                title={copy.head}
                detail="Used only to adapt the shared backbone at this stage."
              />
              <StageCard
                icon={CheckCircle2}
                label="Checkpoint output"
                title={copy.handoff}
                detail="The task head is not carried forward as the final classifier."
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Held-out results</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The stage learned its task successfully.
            </h2>

            <dl className="mx-auto mt-9 grid max-w-3xl gap-6 sm:grid-cols-2">
              <ResultMetric value={formatPercent(result.test.macro_f1)} label="Test Macro-F1" />
              <ResultMetric value={String(result.test.correct) + " / " + String(result.test.samples)} label="Correct predictions" />
            </dl>

            <div className="mx-auto mt-10 max-w-4xl text-left">
              <StageResultsVisuals stageId={stageId} variant="matrix" />
            </div>

            <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-ink-soft">
              Best validation checkpoint selected at epoch {result.best_epoch}. These are image-level held-out results for this temporary training task.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <details className="rounded-2xl border border-line bg-surface px-6 py-5">
              <summary className="cursor-pointer text-center text-base font-semibold text-accent">
                View technical evidence
              </summary>

              <div className="mt-7 border-t border-line pt-7">
                <div className="grid gap-5 md:grid-cols-3">
                  <TechnicalStat label="Initialization" value={copy.init} />
                  <TechnicalStat label="Train / val / test" value={result.split.train + " / " + result.split.val + " / " + result.split.test} />
                  <TechnicalStat label="Evaluation boundary" value={result.caveat} />
                </div>

                <div className="mt-7">
                  <StageResultsVisuals stageId={stageId} />
                </div>

                <div className="mt-7 overflow-hidden rounded-2xl border border-line">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-canvas text-xs text-ink-muted">
                      <tr>
                        <th className="px-6 py-3">Class</th>
                        <th className="px-4 py-3">Precision</th>
                        <th className="px-4 py-3">Recall</th>
                        <th className="px-4 py-3">F1</th>
                        <th className="px-4 py-3">Support</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {result.per_class.map((row) => (
                        <tr key={row.name}>
                          <td className="px-6 py-3 font-semibold text-ink">{row.name}</td>
                          <td className="px-4 py-3">{formatPercent(row.precision)}</td>
                          <td className="px-4 py-3">{formatPercent(row.recall)}</td>
                          <td className="px-4 py-3">{formatPercent(row.f1)}</td>
                          <td className="px-4 py-3">{row.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>

            <div className="mt-10 flex justify-center">
              <Link
                href={copy.nextHref}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
              >
                {copy.nextLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function StageCard({
  icon: Icon,
  label,
  title,
  detail,
}: {
  icon: typeof Database;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-6 text-left shadow-card">
      <Icon className="h-5 w-5 text-accent" aria-hidden />
      <p className="mt-5 text-sm font-semibold text-accent">{label}</p>
      <h3 className="mt-2 text-xl font-semibold leading-7 text-ink">{title}</h3>
      <p className="mt-3 text-base leading-7 text-ink-soft">{detail}</p>
    </article>
  );
}

function ResultMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-line-strong pt-5 text-center">
      <dt className="text-sm font-semibold text-ink-muted">{label}</dt>
      <dd className="metric-tabular mt-2 text-5xl font-semibold tracking-[-0.04em] text-ink sm:text-6xl">{value}</dd>
    </div>
  );
}

function TechnicalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas p-5">
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-ink">{value}</p>
    </div>
  );
}

import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Container } from "@/components/page-header";
import { DATASETS, EXPERIMENT_ROUTES } from "@/lib/research";

export const metadata: Metadata = { title: "Final Stage · WIP" };

const nextSteps = [
  ["Acquire", "Confirm dataset access and provenance"],
  ["Prepare", "Audit data and create the final split"],
  ["Train", "Run all four routes under the same protocol"],
  ["Compare", "Evaluate on one untouched final test set"],
] as const;

export default function FinalStagePage() {
  const finalDataset = DATASETS.find((dataset) => dataset.id === "final");

  return (
    <>
      <section className="border-b border-line bg-ink text-white">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-[#e8c995]">Final stage · Pending dataset access</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              The final cultivar experiment comes next.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
              The experiment design is ready. Final training begins once the raw-cotton dataset is available and verified.
            </p>

            <dl className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
              <FinalMetric value="~3,447" label="Candidate images" />
              <FinalMetric value="5" label="Cultivars" />
              <FinalMetric value="4" label="Controlled routes" />
            </dl>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Controlled comparison</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Four routes. One fair test.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              Dataset split, model architecture, image size and evaluation stay the same. Only the transfer path changes.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {EXPERIMENT_ROUTES.map((route, index) => (
                <article
                  key={route.id}
                  className={index === 3
                    ? "rounded-2xl border border-accent/30 bg-accent-soft p-6 text-left"
                    : "rounded-2xl border border-line bg-surface p-6 text-left shadow-card"}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-sm text-ink-muted">R{index + 1}</span>
                    <span className={index === 3 ? "text-sm font-semibold text-accent" : "text-sm font-semibold text-ink-muted"}>
                      {index === 3 ? "Progressive route" : "Planned"}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-ink">{route.label}</h3>
                  <p className="mt-3 text-lg font-semibold leading-7 text-accent">
                    {route.path.join(" → ")}
                  </p>
                </article>
              ))}
            </div>

            {finalDataset?.source_url ? (
              <a
                href={finalDataset.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-strong"
              >
                Candidate dataset source <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Next steps</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              From dataset access to final evidence.
            </h2>

            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-4">
              {nextSteps.map(([title, detail], index) => (
                <article key={title} className="rounded-2xl border border-line bg-canvas p-5 text-center">
                  <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-xl font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-canvas">
        <Container className="py-16 text-center sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-semibold text-accent">Decision rule</p>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              The winner is decided by final test evidence.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              Macro-F1 is the primary metric, supported by balanced accuracy, worst-class recall, calibration and efficiency.
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-ink-soft">
              If direct ImageNet transfer performs best, that is still a valid research result.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}

function FinalMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-white/20 pt-5 text-center">
      <dt className="text-sm font-semibold text-white/60">{label}</dt>
      <dd className="metric-tabular mt-2 text-5xl font-semibold tracking-[-0.04em] text-white">{value}</dd>
    </div>
  );
}

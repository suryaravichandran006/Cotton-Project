import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { datasetById, formatPercent, stageResultById } from "@/lib/research";

export const metadata: Metadata = { title: "Implementation" };

const challenges = [
  ["Duplicate leaf images", "1,373 → 1,124 clean images before splitting."],
  ["Different task heads", "Transferred only compatible tensors and rebuilt the classifier head."],
  ["Missing specimen IDs", "Report intermediate results as image-level holdouts; group specimens in the final study."],
] as const;

export default function ImplementationPage() {
  const leaf = stageResultById("leaf");
  const seed = stageResultById("seed");
  const leafData = datasetById("leaf");

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">Implementation</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              What we built and verified.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              Two intermediate training stages are complete, and the checkpoint transfer between them is verified.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Completed pipeline</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Data → Leaf → Transfer → Seed
            </h2>

            <ol className="mx-auto mt-10 grid max-w-5xl gap-3">
              <Step
                number="01"
                title="Prepare leaf data"
                metric={String(leafData.images) + " → " + String(leafData.used_images ?? leafData.images)}
                detail="Duplicates and conflicting labels removed before splitting."
              />
              <ArrowDown className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
              <Step
                number="02"
                title="Train leaf stage"
                metric={formatPercent(leaf.test.macro_f1)}
                detail={String(leaf.test.correct) + " / " + String(leaf.test.samples) + " held-out images correct."}
              />
              <ArrowDown className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
              <Step
                number="03"
                title="Transfer checkpoint"
                metric="180 · 2 · 0"
                detail="180 tensors loaded, 2 task-head tensors replaced, 0 unexpected."
              />
              <ArrowDown className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
              <Step
                number="04"
                title="Train seed stage"
                metric={formatPercent(seed.test.macro_f1)}
                detail={String(seed.test.correct) + " / " + String(seed.test.samples) + " held-out images correct."}
              />
            </ol>

            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/models/leaf" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
                Leaf evidence <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/models/seed" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
                Seed evidence <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Problems solved</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Three implementation issues we had to handle.
            </h2>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {challenges.map(([title, detail]) => (
                <article key={title} className="rounded-2xl border border-line bg-canvas p-6 text-left shadow-card">
                  <h3 className="text-xl font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-base leading-7 text-ink-soft">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function Step({
  number,
  title,
  metric,
  detail,
}: {
  number: string;
  title: string;
  metric: string;
  detail: string;
}) {
  return (
    <li className="grid gap-4 rounded-2xl border border-line bg-surface px-6 py-6 text-left shadow-card sm:grid-cols-[56px_1fr_auto] sm:items-center">
      <span className="font-mono text-xs text-ink-muted">{number}</span>
      <div>
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-base leading-7 text-ink-soft">{detail}</p>
      </div>
      <p className="metric-tabular text-3xl font-semibold tracking-[-0.03em] text-accent">{metric}</p>
    </li>
  );
}

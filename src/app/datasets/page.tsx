import type { Metadata } from "next";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";

export const metadata: Metadata = { title: "Approach" };

const progressivePath = [
  ["ImageNet", "general visual features"],
  ["Cotton leaves", "first cotton-domain adaptation"],
  ["Cotton seeds", "more cotton-specific adaptation"],
  ["Raw cotton", "final cultivar task"],
] as const;

export default function ApproachPage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">Approach</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              Why progressive transfer learning?
            </h1>
            <p className="mx-auto mt-6 max-w-4xl text-lg leading-8 text-ink-soft">
              Raw-cotton cultivar data is limited. Instead of relying on one small final dataset, we start with ImageNet knowledge and progressively adapt the same backbone through related cotton domains.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">The challenge</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Why not fine-tune directly on raw cotton?
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              With limited labelled data, direct fine-tuning has less cotton-specific evidence to learn from and can overfit the final dataset.
            </p>

            <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
              <article className="rounded-2xl border border-line bg-surface p-7 text-left shadow-card">
                <p className="text-sm font-semibold text-ink-muted">Direct route</p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">One large domain jump</h3>
                <p className="mt-5 text-xl font-semibold text-accent">ImageNet → Raw cotton</p>
                <p className="mt-4 text-base leading-7 text-ink-soft">
                  The model moves straight from general objects to a small, fine-grained cotton task.
                </p>
              </article>

              <article className="rounded-2xl border border-accent/30 bg-accent-soft p-7 text-left">
                <p className="text-sm font-semibold text-accent">Our proposed route</p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">Adapt in smaller steps</h3>
                <p className="mt-5 text-xl font-semibold text-accent">ImageNet → Leaves → Seeds → Raw cotton</p>
                <p className="mt-4 text-base leading-7 text-ink-soft">
                  The same backbone sees increasingly cotton-specific visual information before the final task.
                </p>
              </article>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Progressive adaptation</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Each stage moves the model closer to cotton.
            </h2>

            <ol className="mx-auto mt-10 grid max-w-5xl gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
              {progressivePath.map(([title, detail], index) => (
                <li key={title} className="contents">
                  <div className="flex min-h-36 flex-col justify-center rounded-2xl border border-line bg-canvas px-5 py-5 text-center">
                    <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-xl font-semibold text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{detail}</p>
                  </div>
                  {index < progressivePath.length - 1 ? (
                    <div className="grid place-items-center text-ink-muted" aria-hidden>
                      <ArrowDown className="h-5 w-5 lg:hidden" />
                      <ArrowRight className="hidden h-5 w-5 lg:block" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
              <article className="rounded-2xl border border-line bg-surface p-6 text-left">
                <p className="text-sm font-semibold text-accent">Why leaves?</p>
                <p className="mt-3 text-lg leading-7 text-ink">
                  They introduce the backbone to cotton-specific visual patterns before the final fibre task.
                </p>
              </article>
              <article className="rounded-2xl border border-line bg-surface p-6 text-left">
                <p className="text-sm font-semibold text-accent">Why seeds?</p>
                <p className="mt-3 text-lg leading-7 text-ink">
                  They add another cotton domain with different shape and surface information before raw cotton.
                </p>
              </article>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-canvas">
        <Container className="py-16 text-center sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-semibold text-accent">Research hypothesis</p>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              Progressive transfer is the idea we are testing — not a result we assume.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ink-soft">
              The final experiment compares this route against direct and partial transfer. If direct ImageNet transfer performs better, that is still a valid result.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { ArrowDown, ExternalLink } from "lucide-react";

import { Container } from "@/components/page-header";
import { LITERATURE, LITERATURE_THEMES } from "@/lib/literature";

export const metadata: Metadata = { title: "Literature" };

const themeCopy = {
  "Plant vision": "Transfer learning works well for plant images, but results can change when the image domain changes.",
  "Feature transfer": "Useful visual features can be reused across tasks, while the final classifier must match the new task.",
  "Cotton imaging": "RGB images can classify cotton seeds and fibres, supporting our final cotton-image task.",
} as const;

export default function LiteraturePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Literature review</p>
            <h1 className="font-display mx-auto mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              What previous research tells us.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              Six studies support the methods used in this project and show what still needs to be tested.
            </p>
          </div>
        </Container>
      </section>

      <Container className="space-y-20 py-16 sm:py-20">
        {LITERATURE_THEMES.map((theme) => {
          const papers = LITERATURE.filter((paper) => paper.theme === theme);
          const id = `theme-${theme.replaceAll(" ", "-").toLowerCase()}`;

          return (
            <section key={theme} aria-labelledby={id} className="border-t border-line-strong pt-10">
              <div className="mx-auto max-w-4xl text-center">
                <h2 id={id} className="font-display text-4xl leading-tight text-ink sm:text-5xl">
                  {theme}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
                  {themeCopy[theme]}
                </p>
              </div>

              <div className="mx-auto mt-9 grid max-w-5xl gap-5 lg:grid-cols-2">
                {papers.map((paper) => (
                  <article key={paper.id} className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold text-accent">{paper.citation} · {paper.year}</p>
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${paper.title}`}
                        className="shrink-0 text-accent transition hover:text-accent-strong"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <h3 className="mt-3 text-xl font-semibold leading-7 tracking-[-0.015em] text-ink">
                      {paper.title}
                    </h3>

                    <div className="mt-6 space-y-5">
                      <div>
                        <p className="text-sm font-semibold text-ink">Key point</p>
                        <p className="mt-1 text-base leading-7 text-ink-soft">{paper.finding}</p>
                      </div>
                      <div className="border-t border-line pt-5">
                        <p className="text-sm font-semibold text-ink">Why it matters here</p>
                        <p className="mt-1 text-base leading-7 text-ink-soft">{paper.connection}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section aria-labelledby="research-gap" className="border-t border-line-strong pt-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Research gap</p>
            <h2 id="research-gap" className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              What still needs to be tested.
            </h2>

            <ol className="mx-auto mt-10 grid max-w-4xl gap-4">
              <GapStep
                title="What we know"
                detail="Transfer learning works for plant images, cotton seeds and cotton fibres."
              />
              <ArrowDown className="mx-auto h-6 w-6 text-ink-muted" aria-hidden />
              <GapStep
                title="What we do not know yet"
                detail="Whether moving through leaf and seed stages improves final cotton cultivar recognition."
                emphasized
              />
              <ArrowDown className="mx-auto h-6 w-6 text-ink-muted" aria-hidden />
              <GapStep
                title="What we will test"
                detail="Direct, partial and progressive transfer routes on the same final dataset and evaluation protocol."
              />
            </ol>
          </div>
        </section>
      </Container>
    </>
  );
}

function GapStep({ title, detail, emphasized = false }: { title: string; detail: string; emphasized?: boolean }) {
  return (
    <li className={emphasized ? "rounded-2xl border border-gold/30 bg-gold-soft px-6 py-6" : "rounded-2xl border border-line bg-surface px-6 py-6"}>
      <h3 className={emphasized ? "text-xl font-semibold text-gold-strong" : "text-xl font-semibold text-ink"}>
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-2xl text-base leading-7 text-ink-soft">{detail}</p>
    </li>
  );
}

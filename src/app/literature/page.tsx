import type { Metadata } from "next";
import { ArrowDown, ExternalLink } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { LITERATURE, LITERATURE_THEMES } from "@/lib/literature";

export const metadata: Metadata = { title: "Literature" };

const themeCopy = {
  "Plant vision": "Transfer learning works well on plant imagery, but controlled datasets can hide real domain shift.",
  "Feature transfer": "A stable backbone can carry reusable features, while task-specific classifier heads should be replaced.",
  "Cotton imaging": "Cotton seeds and fibre are viable RGB vision tasks, but the progressive route still needs a controlled test.",
} as const;

export default function LiteraturePage() {
  return (
    <>
      <PageHeader
        eyebrow="Literature review"
        title="The evidence converges. The exact sequence is still untested."
        description="Six primary studies establish the plant-vision, feature-transfer and cotton-imaging foundations for our experiment."
      />

      <Container className="space-y-20 py-14 sm:py-18">
        {LITERATURE_THEMES.map((theme) => {
          const papers = LITERATURE.filter((paper) => paper.theme === theme);
          return (
            <section key={theme} aria-labelledby={`theme-${theme.replaceAll(" ", "-").toLowerCase()}`} className="grid gap-8 border-t border-line-strong pt-8 lg:grid-cols-[0.62fr_1.38fr]">
              <div>
                <h2 id={`theme-${theme.replaceAll(" ", "-").toLowerCase()}`} className="font-display text-4xl leading-tight text-ink">{theme}</h2>
                <p className="mt-4 max-w-md text-base leading-7 text-ink-soft">{themeCopy[theme]}</p>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                {papers.map((paper) => (
                  <article key={paper.id} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs font-semibold text-accent">{paper.citation} · {paper.year}</p>
                      <a href={paper.url} target="_blank" rel="noreferrer" aria-label={`Open ${paper.title}`} className="shrink-0 text-accent transition hover:text-accent-strong">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-6 tracking-[-0.015em] text-ink">{paper.title}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{paper.venue}{paper.doi ? ` · DOI ${paper.doi}` : ""}</p>
                    <dl className="mt-5 space-y-4 text-sm leading-6">
                      <div><dt className="font-semibold text-ink">What they did</dt><dd className="mt-1 text-ink-soft">{paper.method}</dd></div>
                      <div><dt className="font-semibold text-ink">Key finding</dt><dd className="mt-1 text-ink-soft">{paper.finding}</dd></div>
                      <div><dt className="font-semibold text-ink">Connection to this study</dt><dd className="mt-1 text-ink-soft">{paper.connection}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section aria-labelledby="research-gap" className="rounded-2xl bg-ink px-6 py-10 text-white shadow-lift sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold text-[#b7ddcc]">Research gap</p>
            <h2 id="research-gap" className="font-display mt-3 text-4xl leading-tight text-white sm:text-5xl">What the literature leaves unresolved.</h2>
          </div>
          <ol className="mx-auto mt-9 grid max-w-5xl gap-3 text-center">
            <GapStep title="Existing evidence" detail="Transfer learning works for plant leaves, cotton seeds and cotton fibre." />
            <ArrowDown className="mx-auto h-6 w-6 text-white/45" aria-hidden />
            <GapStep title="Limited evidence" detail="The benefit of moving through related cotton domains in sequence is not yet established." emphasized />
            <ArrowDown className="mx-auto h-6 w-6 text-white/45" aria-hidden />
            <GapStep title="Our controlled experiment" detail="Compare direct, partial and progressive routes on the same final split and evaluation protocol." />
          </ol>
        </section>
      </Container>
    </>
  );
}

function GapStep({ title, detail, emphasized = false }: { title: string; detail: string; emphasized?: boolean }) {
  return (
    <li className={emphasized ? "rounded-2xl border border-[#e8c995]/50 bg-[#e8c995]/10 px-6 py-5" : "rounded-2xl border border-white/15 bg-white/5 px-6 py-5"}>
      <h3 className={emphasized ? "text-lg font-semibold text-[#f1d8ad]" : "text-lg font-semibold text-white"}>{title}</h3>
      <p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-white/65">{detail}</p>
    </li>
  );
}

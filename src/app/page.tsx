/*
THESIS: Cotton Grade is a focused research briefing for accessible, photo-based cotton cultivar recognition.
OWN-WORLD: Use the Architecture page's paper-white canvas, outlined process blocks and restrained cotton palette.
STORY: Begin with the practical goal, show the progressive learning path, state the exact research question, then separate proven evidence from the unanswered final hypothesis.
FIRST VIEWPORT: A centered project statement, concise use-case copy, navigation actions and a clean visual path from one photograph to the intended cultivar output.
FORM: A projector-first academic opener rather than a product dashboard or section directory.
*/

import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { StatusBadge } from "@/components/presentation";

const stages = [
  { number: "01", title: "ImageNet", detail: "pretrained visual features", tone: "border-danger/20 bg-danger-soft", text: "text-danger" },
  { number: "02", title: "Cotton leaves", detail: "1,124 cleaned images", tone: "border-info/25 bg-info-soft", text: "text-info", status: "Complete" },
  { number: "03", title: "Cotton seeds", detail: "450 images", tone: "border-accent/25 bg-accent-soft", text: "text-accent-strong", status: "Complete" },
  { number: "04", title: "Raw cotton", detail: "final cultivar task", tone: "border-gold/25 bg-gold-soft", text: "text-gold-strong", status: "Pending" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Review 3</p>
            <h1 className="font-display mx-auto mt-5 max-w-4xl text-5xl leading-[0.96] text-ink sm:text-6xl lg:text-[4.75rem]">
              Cotton cultivar identification from a single photograph.
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-ink-soft">
              Cotton Grade explores an accessible vision-based approach for small cotton and textile retailers, using an ordinary RGB image instead of specialist equipment.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/progress" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
                See current progress <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/architecture" className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent">
                View architecture
              </Link>
            </div>

            <div className="architecture-paper mx-auto mt-12 rounded-3xl border border-line-strong bg-canvas p-6 text-left shadow-lift sm:p-8 lg:p-9" aria-label="Cotton Grade learning path">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="rounded-2xl border border-line-strong bg-surface px-6 py-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-muted">Input</p>
                  <p className="mt-2 text-xl font-semibold text-ink">One RGB photograph</p>
                  <p className="mt-1 text-sm text-ink-soft">ordinary phone or camera</p>
                </div>

                <div className="grid place-items-center text-ink-muted" aria-hidden>
                  <ArrowDown className="h-5 w-5 md:hidden" />
                  <ArrowRight className="hidden h-5 w-5 md:block" />
                </div>

                <div className="rounded-2xl border border-accent/25 bg-accent-soft px-6 py-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-accent">Intended output</p>
                  <p className="mt-2 text-xl font-semibold text-ink">Cultivar + confidence</p>
                  <p className="mt-1 text-sm text-ink-soft">available after the final study</p>
                </div>
              </div>

              <div className="my-8 border-t border-line" />

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">Progressive learning path</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">The same ConvNeXt-Tiny backbone becomes progressively more cotton-specific.</p>
                </div>
                <StatusBadge state="pending">Final experiment pending</StatusBadge>
              </div>

              <ol className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
                {stages.map((stage, index) => (
                  <li key={stage.title} className="contents">
                    <div className={`flex min-h-36 flex-col rounded-2xl border px-5 py-5 ${stage.tone}`}>
                      <span className="font-mono text-xs text-ink-muted">{stage.number}</span>
                      <p className={`mt-4 text-xl font-semibold ${stage.text}`}>{stage.title}</p>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">{stage.detail}</p>
                      {stage.status ? (
                        <span className="mt-auto pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{stage.status}</span>
                      ) : (
                        <span className="mt-auto pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Initialization</span>
                      )}
                    </div>
                    {index < stages.length - 1 ? (
                      <div className="grid place-items-center text-ink-muted" aria-hidden>
                        <ArrowDown className="h-5 w-5 lg:hidden" />
                        <ArrowRight className="hidden h-5 w-5 lg:block" />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </section>

      <section className="paper-field border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Research question</p>
            <h2 className="font-display mx-auto mt-4 max-w-5xl text-4xl leading-[1.03] text-ink sm:text-5xl lg:text-6xl">
              Does progressive cotton-domain adaptation improve final cultivar recognition compared with direct ImageNet transfer?
            </h2>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Evidence boundary</p>
            <h2 className="font-display mx-auto mt-4 max-w-4xl text-4xl leading-[1.04] text-ink sm:text-5xl">
              What is proven — and what is not.
            </h2>

            <div className="mt-10 grid gap-5 text-left md:grid-cols-2">
              <article className="rounded-2xl border border-accent/25 bg-accent-soft p-6 sm:p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Proven</p>
                <p className="mt-3 text-xl font-semibold leading-8 text-ink">
                  Leaf and seed stages train successfully, and compatible backbone weights transfer between them.
                </p>
              </article>

              <article className="rounded-2xl border border-gold/25 bg-gold-soft p-6 sm:p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold-strong">Not yet proven</p>
                <p className="mt-3 text-xl font-semibold leading-8 text-ink">
                  Whether progressive transfer improves final raw-cotton cultivar recognition.
                </p>
              </article>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

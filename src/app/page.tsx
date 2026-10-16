/*
THESIS: Cotton Grade is a focused research briefing for accessible, photo-based cotton grade recognition.
OWN-WORLD: Use the Architecture page's paper-white canvas, outlined process blocks and restrained cotton palette.
STORY: Begin with the practical goal, show the progressive learning path, state the exact research question, then separate proven evidence from the unanswered final hypothesis.
FIRST VIEWPORT: A centered project statement, concise use-case copy, navigation actions and a clean visual path from one photograph to the intended grade output.
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
  { number: "04", title: "Raw cotton", detail: "final grade task", tone: "border-gold/25 bg-gold-soft", text: "text-gold-strong", status: "Pending" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Review 3</p>
            <h1 className="font-display mx-auto mt-5 max-w-4xl text-5xl leading-[0.96] text-ink sm:text-6xl lg:text-[4.75rem]">
              Cotton grade identification from a single photograph.
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-ink-soft">
              Cotton Grade explores an accessible vision-based approach for small cotton and textile retailers, using an ordinary RGB image instead of specialist equipment.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/datasets" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
                See approach <ArrowRight className="h-4 w-4" />
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
                  <p className="mt-2 text-xl font-semibold text-ink">Grade + confidence</p>
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
                      {"status" in stage && stage.status ? (
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

      <section className="border-b border-line bg-canvas">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="text-center lg:text-left">
                <p className="text-sm font-semibold text-accent">Problem</p>
                <h2 className="font-display mt-4 text-4xl leading-[1.04] text-ink sm:text-5xl">
                  Raw-cotton data is limited.
                </h2>
                <p className="mt-5 text-lg leading-8 text-ink-soft">
                  A small final dataset gives direct fine-tuning less cotton-specific evidence and increases overfitting risk.
                </p>
              </div>

              <div>
                <p className="text-center text-sm font-semibold text-accent lg:text-left">Objectives</p>
                <div className="mt-5 grid gap-4">
                  <Objective number="01" text="Build an ImageNet → Leaf → Seed → Raw Cotton learning path." />
                  <Objective number="02" text="Verify that learned backbone weights transfer correctly between stages." />
                  <Objective number="03" text="Compare progressive transfer fairly against direct and partial transfer." />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="paper-field border-b border-line bg-surface">
        <Container className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold text-accent">Research question</p>
            <h2 className="font-display mx-auto mt-4 max-w-5xl text-4xl leading-[1.03] text-ink sm:text-5xl lg:text-6xl">
              Does progressive cotton-domain adaptation improve final grade recognition compared with direct ImageNet transfer?
            </h2>
          </div>
        </Container>
      </section>
    </>
  );
}


function Objective({ number, text }: { number: string; text: string }) {
  return (
    <div className="grid grid-cols-[40px_1fr] items-start gap-4 rounded-2xl border border-line bg-surface px-5 py-5">
      <span className="font-mono text-xs text-ink-muted">{number}</span>
      <p className="text-lg font-semibold leading-7 text-ink">{text}</p>
    </div>
  );
}

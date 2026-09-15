/*
THESIS: Cotton Grade is a focused research briefing for accessible, photo-based cotton cultivar recognition.
OWN-WORLD: Use the Architecture page's paper-white canvas, outlined process blocks and restrained cotton palette.
STORY: Begin with the practical use case, state the exact research question, then show the evidence boundary.
FIRST VIEWPORT: One ordinary photograph, one intended answer, and the progressive training lineage between them.
FORM: A projector-first academic opener rather than a product dashboard or section directory.
*/

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/page-header";
import { FlowSequence, PresentationMetric, ResearchBoundary, StatusBadge } from "@/components/presentation";

const lineage = [
  { title: "ImageNet", detail: "general features", tone: "rose" as const },
  { title: "Cotton leaves", detail: "1,124 images", tone: "blue" as const, state: "complete" as const },
  { title: "Cotton seeds", detail: "450 images", tone: "green" as const, state: "complete" as const },
  { title: "Raw cotton", detail: "final cultivar task", tone: "gold" as const, state: "pending" as const },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-12 py-14 sm:py-18 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Review 3</p>
            <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[0.95] text-ink sm:text-6xl lg:text-[4.75rem]">
              One cotton photo. A useful cultivar answer.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-ink-soft">
              Cotton Grade is designed for small cotton and textile retailers who need an accessible way to identify the raw cotton they handle without specialist equipment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/progress" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
                See current progress <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/architecture" className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent">
                View architecture
              </Link>
            </div>
          </div>

          <div className="architecture-paper rounded-2xl border border-line-strong bg-canvas p-5 shadow-lift sm:p-7" aria-label="Cotton Grade practical path">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-2xl border border-danger/20 bg-danger-soft px-5 py-5 text-center">
                <p className="text-lg font-semibold text-ink">One RGB photograph</p>
                <p className="mt-1 text-sm text-ink-soft">ordinary phone or camera</p>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-ink-muted sm:block" aria-hidden />
              <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-ink-muted sm:hidden" aria-hidden />
              <div className="rounded-2xl border border-accent/25 bg-accent-soft px-5 py-5 text-center">
                <p className="text-lg font-semibold text-ink">Cultivar + confidence</p>
                <p className="mt-1 text-sm text-ink-soft">intended final output</p>
              </div>
            </div>
            <div className="my-6 border-t border-line" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">How the model learns</p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">Features become progressively more cotton-specific.</p>
              </div>
              <StatusBadge state="pending">Final test pending</StatusBadge>
            </div>
            <FlowSequence steps={lineage} className="mt-5" />
          </div>
        </Container>
      </section>

      <section className="paper-field border-b border-line bg-canvas">
        <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-accent">Research question</p>
            <h2 className="font-display mt-4 max-w-4xl text-4xl leading-[1.03] text-ink sm:text-5xl lg:text-6xl">
              Does progressive cotton-domain adaptation improve final cultivar recognition compared with direct ImageNet transfer?
            </h2>
          </div>
          <dl className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <PresentationMetric value="2" label="Intermediate stages complete" />
            <PresentationMetric value="180" label="Compatible tensors" detail="leaf checkpoint to seed" />
            <PresentationMetric value="1" label="Final experiment pending" />
          </dl>
        </Container>
      </section>

      <section className="bg-surface">
        <Container className="py-14 sm:py-16">
          <ResearchBoundary title="What is proven—and what is not">
            Leaf and seed training confirm that the pipeline learns, evaluates and transfers compatible backbone weights. Only the final four-route experiment can answer whether progressive transfer improves raw-cotton cultivar recognition.
          </ResearchBoundary>
        </Container>
      </section>
    </>
  );
}

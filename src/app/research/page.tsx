import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Target, TriangleAlert } from "lucide-react";
import { Container, PageHeader } from "@/components/page-header";
import { RESEARCH } from "@/lib/research";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage() {
  return (
    <>
      <PageHeader eyebrow="Research" title="Accessible cotton identification from one photograph." description="Cotton Grade is designed for small cotton and textile retailers who need a practical way to identify the raw cotton they handle without specialist equipment." />
      <Container className="space-y-16 py-12">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="paper-field relative overflow-hidden rounded-2xl border border-line bg-surface p-7 shadow-card sm:p-8">
            <div className="soft-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
            <div className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">The problem</p>
              <h2 className="font-display mt-4 max-w-3xl text-4xl leading-tight text-ink sm:text-5xl">Identifying raw cotton should not depend on specialist equipment.</h2>
              <p className="mt-6 max-w-3xl text-sm leading-7 text-ink-soft">The intended system lets a small retailer photograph raw cotton and receive a predicted cultivar. Because cultivars can look similar in ordinary RGB images, Cotton Grade progressively prepares the model through cotton leaf and seed tasks before it reaches the final fibre task.</p>
            </div>
          </article>
          <aside className="relative overflow-hidden rounded-2xl bg-accent p-7 text-white shadow-lift sm:p-8">
            <div className="cotton-glow pointer-events-none absolute -right-16 -top-16 h-52 w-52 opacity-20" aria-hidden />
            <CircleHelp className="relative h-5 w-5 text-white/80" />
            <p className="relative mt-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Research question</p>
            <p className="font-display relative mt-4 text-3xl leading-tight text-white">{RESEARCH.project.research_question}</p>
          </aside>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-line bg-surface p-7">
            <Target className="h-5 w-5 text-accent" />
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Hypothesis</p>
            <p className="font-display mt-3 text-3xl leading-tight text-ink">Progressive adaptation may reduce the representational distance to raw cotton.</p>
            <p className="mt-4 text-sm leading-7 text-ink-soft">{RESEARCH.project.hypothesis}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-7">
            <TriangleAlert className="h-5 w-5 text-gold" />
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Critical constraint</p>
            <p className="font-display mt-3 text-3xl leading-tight text-ink">We do not assume intermediate transfer will help.</p>
            <p className="mt-4 text-sm leading-7 text-ink-soft">Leaves and lint are visually different. Progressive transfer could help, do nothing, or create negative transfer. Direct ImageNet → raw cotton remains the mandatory control, and every route is judged on the same untouched final test set.</p>
          </article>
        </section>

        <section>
          <div className="mb-7 grid gap-4 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Experimental design</p><h2 className="font-display mt-3 text-4xl text-ink">Four routes. One final test set.</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-ink-soft lg:justify-self-end">The only thing that changes is how the backbone is initialized before final cotton training. This isolates the value of each intermediate domain instead of mixing architecture changes with transfer-route changes.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {RESEARCH.experiment_routes.map((route, index) => (
              <div key={route.id} className="grid gap-4 border-b border-line p-6 last:border-b-0 md:grid-cols-[64px_190px_1fr] md:items-center">
                <span className="font-mono text-xs text-ink-muted">E{index}</span>
                <div><h3 className="text-sm font-semibold text-ink">{route.label}</h3><p className="mt-1 text-xs text-ink-muted">{route.question}</p></div>
                <div className="flex flex-wrap items-center gap-2">{route.path.map((node, nodeIndex) => <span key={`${route.id}-${node}`} className="contents"><span className={nodeIndex === route.path.length - 1 ? "rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white" : "rounded-full border border-line bg-surface-muted/55 px-3 py-1.5 text-xs font-medium text-ink-soft"}>{node}</span>{nodeIndex < route.path.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-ink-muted" /> : null}</span>)}</div>
              </div>
            ))}
          </div>
          <Link href="/experiments" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:gap-3">Open the experiment workbench <ArrowRight className="h-4 w-4" /></Link>
        </section>

        <section className="rounded-2xl bg-ink px-6 py-8 text-white sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">What would count as success?</p><p className="font-display mt-3 text-3xl leading-tight">Not just a higher accuracy number.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Higher macro-F1 on the untouched final test set", "Better worst-class recall and balanced accuracy", "Improved calibration without sacrificing acceptance", "Better data efficiency at 25–75% of final training data"].map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/70">{item}</div>)}
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}

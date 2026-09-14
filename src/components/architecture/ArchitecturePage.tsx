"use client";

import type { ComponentType } from "react";
import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Database,
  Image as ImageIcon,
  Layers3,
  ScanLine,
  Split,
  Tag,
} from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { EXPERIMENT_ROUTES } from "@/lib/research";
import { cn } from "@/lib/utils";

type Step = {
  label: string;
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
};

const stages: Array<{
  id: string;
  number: string;
  title: string;
  subtitle: string;
  status: "Complete" | "Pending";
  steps: Step[];
}> = [
  {
    id: "leaves",
    number: "01",
    title: "Cotton leaf adaptation",
    subtitle: "Move general ImageNet features into the cotton domain",
    status: "Complete",
    steps: [
      { label: "Dataset", title: "1,124 leaf images", detail: "Five disease and health classes", icon: Database },
      { label: "Prepare", title: "Audit and split", detail: "Duplicates removed; fixed holdout", icon: Split },
      { label: "Train", title: "Leaf classifier", detail: "ConvNeXt-Tiny with a new 5-class head", icon: BrainCircuit },
      { label: "Output", title: "Leaf checkpoint", detail: "98.80% test Macro-F1", icon: CheckCircle2 },
    ],
  },
  {
    id: "seeds",
    number: "02",
    title: "Cotton seed adaptation",
    subtitle: "Specialize the transferred features toward cotton texture and structure",
    status: "Complete",
    steps: [
      { label: "Dataset", title: "450 seed images", detail: "Broken, cracked and intact", icon: Database },
      { label: "Prepare", title: "Stratified split", detail: "315 train, 67 validation, 68 test", icon: Split },
      { label: "Train", title: "Seed classifier", detail: "Leaf backbone with a new 3-class head", icon: BrainCircuit },
      { label: "Output", title: "Seed checkpoint", detail: "95.61% test Macro-F1", icon: CheckCircle2 },
    ],
  },
  {
    id: "raw-cotton",
    number: "03",
    title: "Raw cotton cultivar identification",
    subtitle: "Train the final photo-based model for the retailer use case",
    status: "Pending",
    steps: [
      { label: "Dataset", title: "Candidate set · 3,447 images", detail: "Five cultivars; access pending", icon: ImageIcon },
      { label: "Prepare", title: "Grouped split", detail: "Keep each specimen in one partition", icon: Split },
      { label: "Train", title: "Four controlled routes", detail: "Same data and protocol; different starts", icon: Layers3 },
      { label: "Output", title: "Final cultivar model", detail: "To be selected by held-out Macro-F1", icon: BrainCircuit },
    ],
  },
];

export function ArchitecturePage() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const runningAnimations: Animation[] = [];
    const transfers = Array.from(canvas.querySelectorAll<HTMLElement>('[data-transfer="complete"]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const handoff = entry.target as HTMLElement;
        const token = handoff.querySelector<HTMLElement>("[data-transfer-token]");
        if (!token || token.dataset.played === "true") return;

        token.dataset.played = "true";
        token.style.willChange = "transform, opacity";
        const distance = Math.max(48, handoff.clientHeight - 34);
        const tokenAnimation = token.animate(
          [
            { opacity: 0, transform: "translate3d(-50%, -4px, 0)" },
            { opacity: 1, transform: "translate3d(-50%, 4px, 0)", offset: 0.16 },
            { opacity: 1, transform: `translate3d(-50%, ${Math.round(distance * 0.82)}px, 0)`, offset: 0.78 },
            { opacity: 0, transform: `translate3d(-50%, ${distance}px, 0)` },
          ],
          { duration: 720, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
        );
        tokenAnimation.addEventListener("finish", () => { token.style.willChange = "auto"; }, { once: true });
        runningAnimations.push(tokenAnimation);

        const receiverEdge = handoff.nextElementSibling?.querySelector<HTMLElement>("[data-receiver-edge]");
        if (receiverEdge) {
          const edgeAnimation = receiverEdge.animate(
            [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }],
            { duration: 520, delay: 500, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
          );
          runningAnimations.push(edgeAnimation);
        }

        observer.unobserve(handoff);
      });
    }, { threshold: 0.35, rootMargin: "0px 0px -10% 0px" });

    transfers.forEach((transfer) => observer.observe(transfer));
    return () => {
      observer.disconnect();
      runningAnimations.forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Training architecture"
        title="From a cotton image to a cultivar prediction."
        description="The system progressively prepares one visual backbone through leaf and seed tasks before training the final raw-cotton identifier."
      />

      <Container className="space-y-14 py-12 sm:py-16">
        <section aria-labelledby="pipeline-title">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Progressive training flow</p>
            <h2 id="pipeline-title" className="font-display mt-3 text-4xl leading-tight text-ink sm:text-5xl">Three stages. One backbone moving forward.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-soft">Each stage follows the same readable flow: dataset, preparation, training and output. Only reusable feature weights move to the next stage.</p>
          </div>

          <StageIndex />

          <div ref={canvasRef} className="architecture-canvas overflow-hidden rounded-2xl bg-ink px-4 py-8 text-white shadow-lift sm:px-8 sm:py-10 lg:px-12">
            <Foundation />

            <Handoff
              mode="initialization"
              label="Initialization"
              title="ImageNet backbone starts the leaf model"
              detail="A new leaf-classification head is attached."
            />

            <StageFlow stage={stages[0]} />

            <Handoff
              mode="verified"
              label="Verified handoff"
              title="Leaf checkpoint starts the seed model"
              detail="180 compatible tensors retained · 2 task-head tensors replaced"
            />

            <StageFlow stage={stages[1]} />

            <Handoff
              mode="planned"
              label="Planned handoff"
              title="Seed checkpoint will start the final model"
              detail="The adapted backbone stays; the seed head is replaced."
            />

            <StageFlow stage={stages[2]} />

            <FutureUse />
          </div>
        </section>

        <section id="comparison" aria-labelledby="comparison-title" className="border-t border-line-strong pt-12">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Final experiment</p>
              <h2 id="comparison-title" className="font-display mt-3 text-4xl leading-tight text-ink">Four routes isolate the value of transfer.</h2>
              <p className="mt-4 text-sm leading-7 text-ink-soft">Final data, model and evaluation stay identical. Only the starting checkpoint changes.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {EXPERIMENT_ROUTES.map((route, index) => (
                <div key={route.id} className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[40px_170px_1fr] sm:items-center sm:px-6">
                  <span className="font-mono text-xs text-ink-muted">R{index + 1}</span>
                  <span className="text-sm font-semibold text-ink">{route.label}</span>
                  <span className="text-sm leading-6 text-ink-soft">{route.path.join(" -> ")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}

function Foundation() {
  return (
    <div id="stage-start" className="scroll-mt-28 mx-auto max-w-xl border border-white/15 bg-white/[0.06] px-5 py-5 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center bg-white/10 text-[#b7ddcc]">
          <Layers3 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Starting point</p>
          <h3 className="mt-1 text-lg font-semibold text-white">ImageNet-pretrained ConvNeXt-Tiny</h3>
          <p className="mt-1 text-xs leading-5 text-white/70">General visual features before cotton-specific training.</p>
        </div>
      </div>
    </div>
  );
}

function StageFlow({ stage }: { stage: (typeof stages)[number] }) {
  const pending = stage.status === "Pending";

  return (
    <article id={`stage-${stage.id}`} className="scroll-mt-28 relative border border-white/15 bg-[#10251c]/95">
      <span data-receiver-edge aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-[#b7ddcc] opacity-0" />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          <span className={pending ? "font-mono text-xs font-semibold text-[#e8c995]" : "font-mono text-xs font-semibold text-[#b7ddcc]"}>{stage.number}</span>
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">{stage.title}</h3>
            <p className="mt-1 text-sm leading-6 text-white/70">{stage.subtitle}</p>
          </div>
        </div>
        <span className={pending ? "text-xs font-semibold text-[#e8c995]" : "text-xs font-semibold text-[#b7ddcc]"}>{stage.status}</span>
      </header>

      <div className="grid px-5 py-5 sm:px-6 md:grid-cols-4 md:gap-5">
        {stage.steps.map((step, index) => (
          <div key={step.label} className="relative flex flex-col md:min-w-0">
            <PipelineStep step={step} pending={pending && index === stage.steps.length - 1} />
            {index < stage.steps.length - 1 ? (
              <>
                <ArrowDown aria-hidden className="mx-auto my-3 h-4 w-4 text-white/55 md:hidden" />
                <ArrowRight aria-hidden className="absolute -right-[18px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-[#79b69d] md:block" />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function PipelineStep({ step, pending }: { step: Step; pending: boolean }) {
  const Icon = step.icon;

  return (
    <div className="flex h-full min-h-32 items-start gap-3 bg-white/[0.045] p-4 md:block">
      <span className={pending ? "grid h-9 w-9 shrink-0 place-items-center bg-[#9a6b34]/20 text-[#e8c995]" : "grid h-9 w-9 shrink-0 place-items-center bg-[#b7ddcc]/10 text-[#b7ddcc]"}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="md:mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{step.label}</p>
        <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
        <p className="mt-1 text-xs leading-5 text-white/70">{step.detail}</p>
      </div>
    </div>
  );
}

function Handoff({ mode, label, title, detail }: { mode: "initialization" | "verified" | "planned"; label: string; title: string; detail: string }) {
  const verified = mode === "verified";
  const planned = mode === "planned";

  return (
    <div data-transfer={planned ? "planned" : "complete"} className="relative flex flex-col items-center py-5 text-center sm:py-6">
      <span
        data-transfer-token
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-2 z-[1] grid h-6 w-6 -translate-x-1/2 place-items-center border",
          planned ? "border-[#e8c995]/50 bg-[#3c3020] text-[#e8c995]" : "border-[#b7ddcc]/50 bg-[#183a2c] text-[#b7ddcc] opacity-0",
        )}
      >
        <Layers3 className="h-3 w-3" />
      </span>
      <div aria-hidden className="h-5 w-px bg-white/20" />
      <ArrowDown aria-hidden className={verified ? "my-2 h-5 w-5 text-[#b7ddcc]" : "my-2 h-5 w-5 text-white/45"} />
      <div className={cn("relative z-10 w-full max-w-3xl px-4 py-3", verified ? "border-y border-[#b7ddcc]/25 bg-[#183127]" : "bg-ink/95")}>
        <div className="mx-auto flex max-w-xl items-center justify-center gap-3 text-left">
          <span aria-hidden className={cn("grid h-8 w-8 shrink-0 place-items-center border", planned ? "border-[#e8c995]/25 text-[#e8c995]" : "border-[#b7ddcc]/20 text-[#b7ddcc]")}>
            <Layers3 className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", verified ? "text-[#b7ddcc]" : planned ? "text-[#e8c995]" : "text-white/65")}>{label} · backbone weights</p>
            <p className="mt-1 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-5 text-white/70">{detail}</p>
          </div>
        </div>
      </div>
      <div aria-hidden className="mt-3 h-5 w-px bg-white/20" />
    </div>
  );
}

function StageIndex() {
  const items = [
    ["Start", "#stage-start"],
    ["Leaves", "#stage-leaves"],
    ["Seeds", "#stage-seeds"],
    ["Raw cotton", "#stage-raw-cotton"],
  ] as const;

  return (
    <nav aria-label="Architecture stages" className="mb-5 grid grid-cols-4 overflow-hidden border border-line bg-surface md:hidden">
      {items.map(([label, href], index) => (
        <a key={href} href={href} className={cn("grid min-h-12 place-items-center px-2 py-2 text-center text-[11px] font-semibold leading-4 text-ink-soft transition hover:bg-surface-muted hover:text-ink", index < items.length - 1 && "border-r border-line")}>{label}</a>
      ))}
    </nav>
  );
}

function FutureUse() {
  const steps = [
    { label: "Retailer photo", detail: "One clear raw-cotton image", icon: Camera },
    { label: "Image check", detail: "Validate quality and prepare the crop", icon: ScanLine },
    { label: "Cultivar prediction", detail: "Return the predicted cotton type", icon: Tag },
  ] as const;

  return (
    <section aria-labelledby="future-use-title" className="mt-6 border border-dashed border-[#e8c995]/35 bg-[#2b2419]/45 px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e8c995]">Intended use after final validation</p>
          <h3 id="future-use-title" className="mt-2 text-xl font-semibold text-white">One photograph in. One cultivar prediction out.</h3>
        </div>
        <span className="text-xs font-semibold text-[#e8c995]">Not yet active</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="contents">
              <div className="flex items-center gap-3 bg-white/[0.045] p-4">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center bg-white/[0.07] text-[#e8c995]"><Icon className="h-4 w-4" /></span>
                <div><p className="text-sm font-semibold text-white">{step.label}</p><p className="mt-1 text-xs leading-5 text-white/70">{step.detail}</p></div>
              </div>
              {index < steps.length - 1 ? <><ArrowDown aria-hidden className="mx-auto h-4 w-4 text-[#e8c995]/60 sm:hidden" /><ArrowRight aria-hidden className="hidden h-4 w-4 text-[#e8c995]/60 sm:block" /></> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

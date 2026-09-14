import type { ComponentType } from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Image as ImageIcon,
  Layers3,
  Split,
} from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { EXPERIMENT_ROUTES } from "@/lib/research";

type Step = {
  label: string;
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
};

const stages: Array<{
  number: string;
  title: string;
  subtitle: string;
  status: "Complete" | "Pending";
  steps: Step[];
}> = [
  {
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
    number: "03",
    title: "Raw cotton cultivar identification",
    subtitle: "Train the final photo-based model for the retailer use case",
    status: "Pending",
    steps: [
      { label: "Dataset", title: "3,447 fibre images", detail: "Five cultivars; access pending", icon: ImageIcon },
      { label: "Prepare", title: "Grouped split", detail: "Keep each specimen in one partition", icon: Split },
      { label: "Train", title: "Four fair routes", detail: "Same data and protocol; different starts", icon: Layers3 },
      { label: "Output", title: "Final cultivar model", detail: "Selected using held-out Macro-F1", icon: BrainCircuit },
    ],
  },
];

export function ArchitecturePage() {
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

          <div className="architecture-canvas overflow-hidden rounded-2xl bg-ink px-4 py-8 text-white shadow-lift sm:px-8 sm:py-10 lg:px-12">
            <Foundation />

            <Handoff
              label="Initialization"
              title="ImageNet backbone starts the leaf model"
              detail="A new leaf-classification head is attached."
            />

            <StageFlow stage={stages[0]} />

            <Handoff
              label="Verified handoff"
              title="Leaf checkpoint starts the seed model"
              detail="180 compatible tensors retained · 2 task-head tensors replaced"
              verified
            />

            <StageFlow stage={stages[1]} />

            <Handoff
              label="Planned handoff"
              title="Seed checkpoint will start the final model"
              detail="The adapted backbone stays; the seed head is replaced."
            />

            <StageFlow stage={stages[2]} />
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
    <div className="mx-auto max-w-xl border border-white/15 bg-white/[0.06] px-5 py-5 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center bg-white/10 text-[#b7ddcc]">
          <Layers3 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">Starting point</p>
          <h3 className="mt-1 text-lg font-semibold text-white">ImageNet-pretrained ConvNeXt-Tiny</h3>
          <p className="mt-1 text-xs leading-5 text-white/60">General visual features before cotton-specific training.</p>
        </div>
      </div>
    </div>
  );
}

function StageFlow({ stage }: { stage: (typeof stages)[number] }) {
  const pending = stage.status === "Pending";

  return (
    <article className="border border-white/15 bg-[#10251c]/95">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          <span className={pending ? "font-mono text-xs font-semibold text-[#e8c995]" : "font-mono text-xs font-semibold text-[#b7ddcc]"}>{stage.number}</span>
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">{stage.title}</h3>
            <p className="mt-1 text-sm leading-6 text-white/55">{stage.subtitle}</p>
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
                <ArrowDown aria-hidden className="mx-auto my-3 h-4 w-4 text-white/35 md:hidden" />
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{step.label}</p>
        <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
        <p className="mt-1 text-xs leading-5 text-white/55">{step.detail}</p>
      </div>
    </div>
  );
}

function Handoff({ label, title, detail, verified = false }: { label: string; title: string; detail: string; verified?: boolean }) {
  return (
    <div className="flex flex-col items-center py-5 text-center sm:py-6">
      <div aria-hidden className="h-5 w-px bg-white/20" />
      <ArrowDown aria-hidden className={verified ? "my-2 h-5 w-5 text-[#b7ddcc]" : "my-2 h-5 w-5 text-white/45"} />
      <div className={verified ? "w-full max-w-3xl border-y border-[#b7ddcc]/25 bg-[#b7ddcc]/[0.07] px-4 py-3" : "w-full max-w-3xl px-4 py-2"}>
        <p className={verified ? "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b7ddcc]" : "text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40"}>{label}</p>
        <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/55">{detail}</p>
      </div>
      <div aria-hidden className="mt-3 h-5 w-px bg-white/20" />
    </div>
  );
}

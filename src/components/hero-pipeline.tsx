"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, Leaf, ScanSearch, Sprout } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STAGES = [
  {
    id: "imagenet",
    number: "00",
    label: "Foundation",
    title: "ImageNet",
    subtitle: "Generic visual representation",
    detail: "Start with a mature visual backbone that already understands edges, shapes, colour relationships and reusable texture primitives.",
    foot: "Pretrained initialization",
    icon: BrainCircuit,
  },
  {
    id: "leaf",
    number: "01",
    label: "Intermediate model 1",
    title: "Cotton leaves",
    subtitle: "Cotton-domain adaptation",
    detail: "Fine-tune on the five-class cotton leaf disease/health dataset so generic visual features become sensitive to cotton morphology, lesions, discoloration and fine surface texture.",
    foot: "1,124 cleaned images · 5 classes · test macro-F1 98.80%",
    icon: Leaf,
  },
  {
    id: "seed",
    number: "02",
    label: "Intermediate model 2",
    title: "Cotton seeds",
    subtitle: "Fine material adaptation",
    detail: "Load the best leaf checkpoint, replace its five-class task head and adapt the compatible backbone further toward seed texture, cracks, boundaries and small surface irregularities.",
    foot: "450 RGB images · 3 classes · test macro-F1 95.61%",
    icon: Sprout,
  },
  {
    id: "final",
    number: "03",
    label: "Final model",
    title: "Raw cotton fibre",
    subtitle: "Cultivar classification",
    detail: "Replace the seed head with the final cultivar head and fine-tune on raw or ginned lint. Only this final model is deployed at inference time.",
    foot: "CATGO target · access pending",
    icon: ScanSearch,
  },
] as const;

export function HeroPipeline() {
  const [active, setActive] = useState(1);
  const reduceMotion = useReducedMotion();
  const stage = STAGES[active];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="grid lg:grid-cols-[1.32fr_0.68fr]">
        <div className="relative border-b border-line p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="soft-grid pointer-events-none absolute inset-0 opacity-45" aria-hidden />
          <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((item, index) => {
              const Icon = item.icon;
              const selected = active === index;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-pressed={selected}
                  className={cn(
                    "group relative min-h-44 overflow-hidden rounded-xl border p-4 text-left transition",
                    selected ? "border-accent/40 bg-accent text-white shadow-lift" : "border-line bg-surface/90 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card",
                  )}
                >
                  {selected && !reduceMotion ? <motion.span layoutId="hero-stage-active" className="absolute inset-x-0 top-0 h-0.5 bg-white/80" /> : null}
                  <div className="flex items-start justify-between gap-4">
                    <span className={cn("font-mono text-[10px] tracking-[0.16em]", selected ? "text-white/60" : "text-ink-muted")}>{item.number}</span>
                    <Icon className={cn("h-4 w-4", selected ? "text-white/80" : "text-accent")} aria-hidden />
                  </div>
                  <p className={cn("mt-8 text-[10px] font-semibold uppercase tracking-[0.18em]", selected ? "text-white/65" : "text-accent")}>{item.label}</p>
                  <h3 className={cn("mt-2 text-lg font-semibold tracking-[-0.02em]", selected ? "text-white" : "text-ink")}>{item.title}</h3>
                  <p className={cn("mt-1 text-xs leading-5", selected ? "text-white/70" : "text-ink-muted")}>{item.subtitle}</p>
                </button>
              );
            })}
          </div>
          <div className="relative mt-4 hidden items-center px-4 xl:flex" aria-hidden>
            {STAGES.map((item, index) => (
              <div key={item.id} className="flex flex-1 items-center last:flex-none">
                <span className={cn("h-2 w-2 rounded-full border", index <= active ? "border-accent bg-accent" : "border-line-strong bg-surface")} />
                {index < STAGES.length - 1 ? <span className="h-px flex-1 bg-line"><motion.span className="block h-px bg-accent" animate={{ scaleX: index < active ? 1 : 0 }} style={{ transformOrigin: "left" }} transition={{ duration: reduceMotion ? 0 : 0.35 }} /></span> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-ink p-6 text-white sm:p-8">
          <div className="cotton-glow pointer-events-none absolute -right-28 -top-20 h-64 w-64 opacity-25" aria-hidden />
          <AnimatePresence mode="wait">
            <motion.div key={stage.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Selected stage · {stage.number}</p>
              <h3 className="font-display mt-4 text-3xl leading-none text-white">{stage.title}</h3>
              <p className="mt-5 text-sm leading-7 text-white/70">{stage.detail}</p>
            </motion.div>
          </AnimatePresence>
          <div className="relative mt-8 border-t border-white/12 pt-4">
            <p className="text-[11px] font-medium text-white/50">{stage.foot}</p>
            <p className="mt-2 text-xs leading-5 text-white/35">The task-specific head is replaced between stages; compatible backbone weights move forward.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

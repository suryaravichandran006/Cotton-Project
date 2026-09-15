"use client";

/*
THESIS: One ConvNeXt-Tiny backbone moves downward through verified training stages into a pending controlled experiment; no dashboard or generic card wall.
OWN-WORLD: Warm technical paper, charcoal diagram strokes, pale pink inputs, yellow transforms, blue models, green outputs and violet serving nodes.
STORY: Reviewers see the start, repeated leaf and seed training grammar, what transfers, the fair final comparison and the one-model runtime.
FIRST VIEWPORT: A broad paper figure begins with the centered ImageNet-to-backbone stack and a secondary transfer legend, followed by the first complete stage.
FORM: Academic architecture plate, directly pinned by the supplied visual reference; responsive CSS and small connector SVGs keep labels native HTML.
*/

import { useEffect, useRef } from "react";

import type { ArchitectureViewModel } from "@/components/architecture/architecture-data";
import { ArchitectureNode } from "@/components/architecture/ArchitectureNode";
import { FinalExperiment } from "@/components/architecture/FinalExperiment";
import { ProductionFlow } from "@/components/architecture/ProductionFlow";
import { StagePanel } from "@/components/architecture/StagePanel";
import { TransferHandoff } from "@/components/architecture/TransferHandoff";
import { TransferLegend } from "@/components/architecture/TransferLegend";
import { VerticalConnector } from "@/components/architecture/connectors";

export function ArchitectureDiagram({ data }: { data: ArchitectureViewModel }) {
  const diagramRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const diagram = diagramRef.current;
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!diagram || reducedMotion || !("IntersectionObserver" in window)) return;

    const animations: Animation[] = [];
    const target = diagram.querySelector<HTMLElement>('[data-transfer="complete"]');
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || target.dataset.played === "true") return;
      target.dataset.played = "true";

      const token = target.querySelector<HTMLElement>("[data-transfer-token]");
      const receiver = diagram.querySelector<HTMLElement>('[data-receiver="seed"] [data-receiver-edge]');

      if (token) {
        token.style.willChange = "transform, opacity";
        const tokenAnimation = token.animate(
          [
            { opacity: 0, transform: "translate3d(-50%, -3px, 0) scale(.85)" },
            { opacity: 1, transform: "translate3d(-50%, 6px, 0) scale(1)", offset: 0.2 },
            { opacity: 1, transform: "translate3d(-50%, 30px, 0) scale(1)", offset: 0.72 },
            { opacity: 0, transform: "translate3d(-50%, 39px, 0) scale(.9)" },
          ],
          { duration: 680, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
        );
        tokenAnimation.addEventListener("finish", () => { token.style.willChange = "auto"; }, { once: true });
        animations.push(tokenAnimation);
      }

      if (receiver) {
        animations.push(receiver.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }],
          { duration: 520, delay: 500, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        ));
      }
      observer.disconnect();
    }, { threshold: 0.55, rootMargin: "0px 0px -8% 0px" });

    observer.observe(target);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <figure
      ref={diagramRef}
      aria-label="Cotton Grade progressive transfer-learning architecture from ImageNet pretraining through cotton leaf and seed adaptation, a pending four-route final cotton experiment, and production inference using only the selected final model."
      className="architecture-paper rounded-2xl border border-[#cfd4cf] bg-[#fffefa] px-4 py-8 text-[#18211c] shadow-[0_18px_50px_-34px_rgba(20,32,25,0.42)] sm:px-7 sm:py-10 lg:px-10 lg:py-12"
    >
      <p className="sr-only">ImageNet initializes ConvNeXt-Tiny. Stage one trains on cotton leaves, then transfers compatible backbone weights to stage two cotton seeds while replacing the task head. Four final routes will be compared on the same raw cotton dataset. Only the selected final cultivar model is served through FastAPI.</p>

      <header className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#526158]">Cotton Grade</p>
        <h2 className="mt-2 text-balance text-3xl font-black leading-[1.02] tracking-[-0.035em] text-[#101712] sm:text-4xl lg:text-5xl">Progressive Transfer Learning Architecture</h2>
      </header>

      <section aria-label="ImageNet initialization" className="mx-auto mt-9 grid max-w-5xl items-center gap-6 lg:grid-cols-[1fr_310px_1fr]">
        <div className="hidden lg:block" />
        <div className="flex flex-col items-center">
          <ArchitectureNode title="ImageNet-1K" detail="Pretraining" tone="dataset" className="min-h-[82px]" />
          <VerticalConnector className="h-12" />
          <ArchitectureNode title="ConvNeXt-Tiny" detail="Backbone · General visual features" tone="model" className="min-h-[100px]" />
        </div>
        <TransferLegend />
      </section>

      <VerticalConnector className="h-14" />
      <StagePanel stage={data.stages[0]} />
      <TransferHandoff status="verified" tensors={data.verifiedTransfer.tensors} replaced={data.verifiedTransfer.replaced} />
      <StagePanel stage={data.stages[1]} />
      <TransferHandoff status="planned" />
      <FinalExperiment experiment={data.finalExperiment} />

      <div className="grid items-center lg:grid-cols-[1fr_310px_1fr]">
        <div className="hidden lg:block" />
        <div className="flex flex-col items-center">
          <VerticalConnector className="h-14" />
          <ArchitectureNode title="Final Cultivar Model" detail={`Raw / Ginned Cotton · ${data.finalExperiment.classCount} cultivars · dataset pending`} tone="model" className="min-h-[100px]" />
          <VerticalConnector className="h-14" />
        </div>
        <aside className="mb-5 rounded-lg border-2 border-dashed border-[#667068] bg-[#fffefa] px-4 py-3 text-center text-sm font-semibold leading-6 text-[#344038] lg:mb-0 lg:ml-6 lg:text-left">
          Leaf and seed models are training stages only.
        </aside>
      </div>

      <ProductionFlow />
    </figure>
  );
}

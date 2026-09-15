import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";
import { FlowSequence, ResearchBoundary, SectionIntro, StatusBadge } from "@/components/presentation";
import { DATASETS, formatCount } from "@/lib/research";

export const metadata: Metadata = { title: "Method" };

const dataStages = [
  { title: "ImageNet weights", detail: "pretrained starting point", tone: "rose" as const },
  { title: "Cotton leaves", detail: "1,124 images · 5 classes", tone: "blue" as const, state: "complete" as const },
  { title: "Cotton seeds", detail: "450 images · 3 classes", tone: "green" as const, state: "complete" as const },
  { title: "Raw cotton", detail: "~3,447 images · 5 cultivars", tone: "gold" as const, state: "pending" as const },
];

const processing = [
  { title: "Audit", detail: "integrity + duplicates", tone: "rose" as const },
  { title: "Split", detail: "fixed manifests", tone: "gold" as const },
  { title: "Resize", detail: "224 × 224 RGB", tone: "blue" as const },
  { title: "Augment", detail: "training only", tone: "violet" as const },
  { title: "Train", detail: "select on validation", tone: "green" as const },
  { title: "Evaluate", detail: "untouched test set", tone: "blue" as const },
];

const anchors = [
  ["Backbone", "ConvNeXt-Tiny"],
  ["Input", "224 × 224 RGB"],
  ["Optimizer", "AdamW"],
  ["Primary metric", "Macro-F1"],
] as const;

export default function MethodPage() {
  return (
    <>
      <PageHeader
        eyebrow="Method"
        title="The data becomes progressively more cotton-specific."
        description="Two questions define the method: which visual domain is used at each stage, and how every dataset becomes fair training evidence."
      />

      <Container className="space-y-20 py-14 sm:py-18">
        <section aria-labelledby="stage-data">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionIntro title="1. What data enters each stage?" />
            <StatusBadge state="pending">Final data access pending</StatusBadge>
          </div>
          <FlowSequence steps={dataStages} className="mt-9" />
          <div className="mt-5 grid gap-3 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
            <span>ImageNet: pretrained starting point</span>
            {DATASETS.map((dataset) => (
              <a key={dataset.id} href={dataset.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-accent">
                {dataset.id === "leaf" ? "Leaves" : dataset.id === "seed" ? "Seeds" : "Raw cotton"}: dataset source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </section>

        <section aria-labelledby="processing">
          <SectionIntro title="2. How is it processed?" body="Split assignment happens before augmentation. The final study also groups images from the same physical specimen wherever identifiers are available." />
          <FlowSequence steps={processing} className="mt-9" />
        </section>

        <section aria-label="Method anchors" className="rounded-2xl bg-ink px-6 py-7 text-white shadow-lift sm:px-8">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {anchors.map(([label, value]) => (
              <div key={label} className="border-t border-white/20 pt-4"><dt className="text-xs text-white/55">{label}</dt><dd className="mt-2 text-xl font-semibold text-white">{value}</dd></div>
            ))}
          </dl>
        </section>

        <details className="rounded-2xl border border-line bg-surface px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-accent">Dataset audit and protocol detail</summary>
          <div className="mt-5 grid gap-6 border-t border-line pt-5 text-sm leading-6 md:grid-cols-3">
            {DATASETS.map((dataset) => (
              <div key={dataset.id}>
                <p className="font-semibold text-ink">{dataset.domain}</p>
                <p className="mt-2 text-ink-soft">{dataset.source_scope}</p>
                <p className="mt-2 text-xs text-ink-muted">Source: {formatCount(dataset.images)} · Used: {dataset.used_images ? formatCount(dataset.used_images) : "pending"} · Classes: {dataset.classes}</p>
              </div>
            ))}
          </div>
        </details>

        <ResearchBoundary title="Evaluation boundary">
          Leaf and seed scores are image-level held-out results because their public sources provide no specimen identifiers. The final cultivar study will use grouped specimen splitting wherever provenance permits.
        </ResearchBoundary>

        <div className="flex justify-end border-t border-line pt-8">
          <Link href="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:text-accent-strong">
            Review measured results <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

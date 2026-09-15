import type { ReactNode } from "react";

import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "green" | "gold" | "blue" | "rose" | "violet";

const toneClasses: Record<Tone, string> = {
  green: "border-accent/25 bg-accent-soft text-accent-strong",
  gold: "border-gold/25 bg-gold-soft text-gold-strong",
  blue: "border-info/25 bg-info-soft text-info",
  rose: "border-danger/20 bg-danger-soft text-danger",
  violet: "border-[#6f5b9a]/20 bg-[#eee9f7] text-[#59427f]",
};

export function StatusBadge({ children, state = "complete" }: { children: ReactNode; state?: "complete" | "pending" | "proposed" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        state === "complete" && "bg-accent-soft text-accent-strong",
        state === "pending" && "bg-gold-soft text-gold-strong",
        state === "proposed" && "bg-info-soft text-info",
      )}
    >
      {state === "complete" ? <Check className="h-3 w-3" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function PresentationMetric({ value, label, detail, inverse = false }: { value: string; label: string; detail?: string; inverse?: boolean }) {
  return (
    <div className={cn("border-t pt-4", inverse ? "border-white/20" : "border-line-strong")}>
      <p className={cn("metric-tabular text-3xl font-semibold tracking-[-0.025em] sm:text-4xl", inverse ? "text-white" : "text-ink")}>{value}</p>
      <p className={cn("mt-2 text-sm font-semibold", inverse ? "text-white/85" : "text-ink")}>{label}</p>
      {detail ? <p className={cn("mt-1 text-xs leading-5", inverse ? "text-white/60" : "text-ink-muted")}>{detail}</p> : null}
    </div>
  );
}

export function SectionIntro({ title, body, className }: { title: string; body?: ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <h2 className="font-display text-4xl leading-[1.04] text-ink sm:text-5xl">{title}</h2>
      {body ? <div className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">{body}</div> : null}
    </div>
  );
}

export function FlowSequence({ steps, className }: { steps: ReadonlyArray<{ title: string; detail?: string; tone?: Tone; state?: "complete" | "pending" }>; className?: string }) {
  return (
    <ol className={cn("grid items-stretch gap-3 lg:grid-flow-col lg:auto-cols-fr", className)}>
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`} className="contents">
          <div className={cn("flex min-h-24 flex-col justify-center rounded-2xl border px-4 py-4 text-center", toneClasses[step.tone ?? "green"])}>
            <p className="text-base font-semibold leading-5">{step.title}</p>
            {step.detail ? <p className="mt-1 text-sm leading-5 opacity-80">{step.detail}</p> : null}
            {step.state ? <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">{step.state}</span> : null}
          </div>
          {index < steps.length - 1 ? (
            <div className="grid place-items-center text-ink-muted" aria-hidden>
              <ArrowDown className="h-5 w-5 lg:hidden" />
              <ArrowRight className="hidden h-5 w-5 lg:block" />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ResearchBoundary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-2xl bg-ink px-6 py-7 text-white shadow-lift sm:px-8 sm:py-8">
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">{title}</h2>
        <div className="max-w-3xl text-sm leading-7 text-white/70 sm:text-base">{children}</div>
      </div>
    </aside>
  );
}

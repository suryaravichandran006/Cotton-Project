"use client";

import { AlertTriangle, Clock, Cpu, FlaskConical, Info, Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { VarietyDetailCard } from "@/components/VarietyDetailCard";
import type { PredictionResponse } from "@/lib/types";
import { cn, confidenceLevelMeta, formatBytes, formatDateTime, formatMs, formatPercent } from "@/lib/utils";

export function MockNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" data-testid="mock-notice" className={cn("flex items-start gap-3 rounded-lg border border-warn/30 bg-warn-soft text-warn", compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm")}>
      <FlaskConical className={cn("shrink-0", compact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4")} aria-hidden />
      <div>
        <p className="font-semibold uppercase tracking-wide">Demo mode — no trained model loaded</p>
        <p className="mt-0.5">Demo prediction — trained model not yet installed. This output is a deterministic placeholder and must not be interpreted as a cultivar identification.</p>
      </div>
    </div>
  );
}

export function ConfidenceBar({ value, tone = "accent", label }: { value: number; tone?: "accent" | "neutral" | "warn"; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone === "accent" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-line-strong")} style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}

export function TopPredictions({ items, highlight }: { items: PredictionResponse["top_predictions"]; highlight: string }) {
  return (
    <ol className="space-y-3" data-testid="top-predictions">
      {items.map((t) => {
        const isTop = t.class_name === highlight;
        return (
          <li key={t.class_name} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="text-xs font-mono text-ink-muted">#{t.rank}</span>
            <span className={cn("truncate text-sm", isTop ? "font-semibold text-ink" : "text-ink-soft")}>{t.display_name}</span>
            <span className="text-sm tabular-nums text-ink">{formatPercent(t.calibrated_confidence)}</span>
            <span />
            <div className="col-span-2">
              <ConfidenceBar value={t.calibrated_confidence} tone={isTop ? "accent" : "neutral"} label={`${t.display_name} calibrated confidence`} />
            </div>
            <span />
            <span className="col-span-2 text-[11px] text-ink-muted">raw softmax {formatPercent(t.raw_probability)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-ink", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

export function PredictionResult({ result }: { result: PredictionResponse }) {
  const [view, setView] = useState<"original" | "gradcam">(result.explanation.available ? "gradcam" : "original");
  const level = confidenceLevelMeta[result.prediction.confidence_level];
  const unknown = result.prediction.is_unknown;

  return (
    <div className="space-y-6">
      {result.is_mock ? <MockNotice /> : null}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* ---- headline ---------------------------------------------------- */}
        <Card className="overflow-hidden">
          <CardBody className="px-6 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={level.tone}>{level.label}</Badge>
              {result.is_mock ? <Badge tone="warn">Mock</Badge> : null}
              <span className="text-xs text-ink-muted">{formatDateTime(result.created_at)}</span>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{unknown ? "Result" : "Predicted cotton variety"}</p>
            <h2 data-testid="predicted-class" className={cn("mt-1 text-3xl font-semibold tracking-tight sm:text-4xl", unknown ? "text-danger" : "text-ink")}>
              {unknown ? "Unknown / low confidence" : result.prediction.display_name}
            </h2>
            {unknown ? (
              <p className="mt-2 text-sm text-ink-soft">
                Closest known class: <span className="font-medium text-ink">{result.prediction.display_name}</span> at {formatPercent(result.prediction.confidence)} — below the rejection
                threshold, so no variety is asserted.
              </p>
            ) : null}

            <div className="mt-6 flex items-end gap-3">
              <span className="text-5xl font-semibold tabular-nums tracking-tight text-ink">{formatPercent(result.prediction.confidence)}</span>
              <span className="pb-2 text-sm text-ink-muted">calibrated confidence</span>
            </div>
            <div className="mt-3">
              <ConfidenceBar value={result.prediction.confidence} tone={unknown ? "warn" : "accent"} label="Calibrated confidence" />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              raw softmax {formatPercent(result.prediction.raw_probability)} · temperature-scaled on validation data · unknown threshold{" "}
              {result.ood.scores.threshold !== undefined ? formatPercent(result.ood.scores.threshold, 0) : "configured server-side"}
            </p>

            <div className="mt-6 rounded-md border border-line bg-canvas px-4 py-3 text-sm leading-6 text-ink-soft">
              <p className="flex items-start gap-2">
                <Info className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                <span>{level.description}</span>
              </p>
              {result.prediction.unknown_reason ? <p className="mt-1 pl-6 text-xs text-ink-muted">Reason: {result.prediction.unknown_reason}</p> : null}
            </div>

            {result.warnings.filter((w) => !w.startsWith("Demo prediction")).map((w) => (
              <p key={w} className="mt-3 flex items-start gap-2 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
              </p>
            ))}
          </CardBody>
        </Card>

        {/* ---- images ------------------------------------------------------ */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Image & explanation"
            description={result.explanation.note ?? "Grad-CAM was not requested for this prediction."}
            action={
              <div role="tablist" aria-label="Image view" className="flex rounded-md border border-line p-0.5 text-xs">
                <button role="tab" aria-selected={view === "original"} className={cn("rounded px-2.5 py-1", view === "original" && "bg-surface-muted font-medium")} onClick={() => setView("original")}>
                  Original
                </button>
                <button
                  role="tab"
                  aria-selected={view === "gradcam"}
                  disabled={!result.explanation.available}
                  className={cn("rounded px-2.5 py-1 disabled:opacity-40", view === "gradcam" && "bg-surface-muted font-medium")}
                  onClick={() => setView("gradcam")}
                >
                  Heatmap
                </button>
              </div>
            }
          />
          <div className="relative flex min-h-[280px] items-center justify-center bg-surface-muted">
            {view === "gradcam" && result.explanation.gradcam_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic backend-hosted image
              <img src={result.explanation.gradcam_url} alt={`${result.is_mock ? "Demonstration" : "Grad-CAM"} heatmap overlay for ${result.prediction.display_name}`} className="max-h-[420px] w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic backend-hosted image
              <img src={result.image.url} alt={`Uploaded cotton fibre image${result.image.original_filename ? ` (${result.image.original_filename})` : ""}`} className="max-h-[420px] w-full object-contain" />
            )}
            {view === "gradcam" && result.is_mock ? (
              <span className="absolute left-3 top-3 rounded bg-ink/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Demo heatmap — not a model explanation</span>
            ) : null}
          </div>
          <CardBody className="text-xs text-ink-muted">
            {result.explanation.error ? <p className="text-danger">Grad-CAM failed: {result.explanation.error}</p> : null}
            <p>
              {result.image.width}×{result.image.height} px · {result.image.format} · {formatBytes(result.image.size_bytes)}
              {result.image.original_filename ? ` · ${result.image.original_filename}` : ""}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Ranked predictions" description="Calibrated confidence per class" />
          <CardBody>
            <TopPredictions items={result.top_predictions} highlight={result.prediction.class_name} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Model & processing" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Stat label="Model" value={result.model.name} mono />
              <Stat label="Version" value={result.model.version} mono />
              <Stat label="Architecture" value={result.model.architecture} />
              <Stat label="Device" value={result.processing.device} />
              <Stat label="Preprocess" value={formatMs(result.processing.preprocess_ms)} />
              <Stat label="Inference" value={formatMs(result.processing.inference_ms)} />
              <Stat label="Explainability" value={formatMs(result.processing.explainability_ms)} />
              <Stat label="Total" value={formatMs(result.processing.total_ms)} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5" aria-hidden /> {result.processing.device}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {formatMs(result.processing.total_ms)} end-to-end
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" aria-hidden /> OOD: {result.ood.strategy.replace(/_/g, " ")}
              </span>
            </div>
          </CardBody>
        </Card>

        <VarietyDetailCard variety={result.variety} isUnknown={unknown} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-5 py-4 text-xs leading-5 text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl">
          <span className="font-semibold text-ink-soft">Scientific Disclaimer.</span> Decision-support tool; does not replace laboratory physical testing. Cultivar identity should be confirmed by laboratory or
          documentary evidence (e.g. seed provenance, HVI/AFIS physical fibre testing) before any commercial or regulatory use.
        </p>
        <div className="flex shrink-0 gap-2">
          <ButtonLink href="/analyze" variant="secondary" size="sm">
            Analyze another
          </ButtonLink>
          <Link href="/history" className="inline-flex h-8 items-center px-2 text-xs font-medium text-ink-soft hover:text-ink">
            View history
          </Link>
        </div>
      </div>
    </div>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ConfidenceLevel } from "@/lib/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const confidenceLevelMeta: Record<ConfidenceLevel, { label: string; tone: "accent" | "info" | "warn" | "danger"; description: string }> = {
  high: { label: "High confidence", tone: "accent", description: "Calibrated confidence ≥ 85%. The model's ranking is strongly separated." },
  medium: { label: "Medium confidence", tone: "info", description: "Calibrated confidence between 65% and 85%. Consider a second photograph under better lighting." },
  low: { label: "Low confidence", tone: "warn", description: "Calibrated confidence below 65% but above the unknown threshold. Treat as a weak hint only." },
  unknown: { label: "Unknown / low confidence", tone: "danger", description: "Confidence fell below the rejection threshold. The sample may not belong to any known variety or the photo may be unsuitable." },
};

export const toneClasses: Record<"accent" | "info" | "warn" | "danger" | "neutral", string> = {
  accent: "bg-accent-soft text-accent-strong border-accent/20",
  info: "bg-info-soft text-info border-info/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  neutral: "bg-surface-muted text-ink-soft border-line",
};

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, CheckCircle2, Crown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type RouteResult = {
  id: string;
  label: string;
  path: string[];
  status: "pending" | "complete" | "missing";
  metrics: Record<string, number | null>;
  report_dir?: string | null;
};

type Comparison = {
  status: "pending" | "partial" | "complete";
  generated_at?: string | null;
  routes: RouteResult[];
  winner?: string | null;
  message?: string;
};

const METRICS = [
  ["macro_f1", "Macro-F1"],
  ["balanced_accuracy", "Balanced accuracy"],
  ["accuracy", "Accuracy"],
  ["ece", "ECE ↓"],
] as const;

export function ExperimentResults() {
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/api/v1/research/experiments", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        return (await res.json()) as Comparison;
      })
      .then(setData)
      .catch((err) => {
        if (err?.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.routes
      .filter((route) => route.status === "complete" && typeof route.metrics.macro_f1 === "number")
      .map((route) => ({ id: route.id, label: route.label, macroF1: Number(route.metrics.macro_f1) * 100 }));
  }, [data]);

  if (error) {
    return <EmptyState icon={AlertCircle} title="Experiment API is offline" body="Start the FastAPI backend to load experiment outputs. The frontend never substitutes fabricated values." />;
  }
  if (!data) {
    return <div className="h-72 animate-pulse rounded-2xl border border-line bg-surface-muted/50" aria-label="Loading experiment results" />;
  }
  if (data.status === "pending" || !data.routes.some((route) => route.status === "complete")) {
    return <EmptyState icon={BarChart3} title="The result surface is ready. The evidence is not yet." body={data.message ?? "When real training reports exist, this panel automatically becomes the live comparison dashboard. Until then, metrics remain intentionally empty."} />;
  }

  const winner = data.routes.find((route) => route.id === data.winner);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <article className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white shadow-lift">
          <div className="cotton-glow pointer-events-none absolute -right-20 -top-20 h-56 w-56 opacity-20" aria-hidden />
          <Crown className="relative h-5 w-5 text-white/70" />
          <p className="relative mt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Current winning route</p>
          <h3 className="font-display relative mt-3 text-3xl text-white">{winner?.label ?? "Comparison incomplete"}</h3>
          <p className="relative mt-4 font-mono text-[10px] leading-5 text-white/45">{winner ? winner.path.join(" → ") : "Awaiting all required reports"}</p>
          {winner && typeof winner.metrics.macro_f1 === "number" ? <div className="relative mt-8 border-t border-white/10 pt-5"><p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Test macro-F1</p><p className="metric-tabular mt-2 text-4xl font-semibold">{(winner.metrics.macro_f1 * 100).toFixed(2)}%</p></div> : null}
        </article>

        <article className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Primary metric</p><h3 className="font-display mt-2 text-3xl text-ink">Macro-F1 by transfer route</h3></div><span className="rounded-full border border-line px-3 py-1 text-[10px] text-ink-muted">higher is better</span></div>
          <div className="mt-6 h-64" role="img" aria-label="Macro-F1 bar chart comparing completed transfer routes">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} width={34} />
                <Tooltip cursor={{ fill: "var(--color-surface-muted)" }} contentStyle={{ border: "1px solid var(--color-line)", borderRadius: 10, background: "var(--color-surface)", fontSize: 12 }} />
                <Bar dataKey="macroF1" name="Macro-F1 (%)" fill="var(--color-accent)" radius={6} maxBarSize={58} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-line bg-surface-muted/45 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              <tr><th className="px-5 py-3 font-semibold">Transfer route</th>{METRICS.map(([, label]) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}<th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.routes.map((route) => (
                <tr key={route.id} className={cn("transition", data.winner === route.id ? "bg-accent-soft/55" : "hover:bg-surface-muted/30")}>
                  <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-semibold text-ink">{route.label}</span>{data.winner === route.id ? <Crown className="h-3.5 w-3.5 text-accent" /> : null}</div><div className="mt-1 font-mono text-[10px] text-ink-muted">{route.path.join(" → ")}</div></td>
                  {METRICS.map(([key]) => <td key={key} className="metric-tabular px-4 py-4 font-mono text-xs text-ink">{typeof route.metrics[key] === "number" ? route.metrics[key]!.toFixed(4) : "—"}</td>)}
                  <td className="px-4 py-4">{route.status === "complete" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> complete</span> : <span className="text-xs text-ink-muted">{route.status}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof AlertCircle; title: string; body: string }) {
  return (
    <div className="paper-field relative overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center shadow-card sm:p-12">
      <div className="soft-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-full border border-accent/20 bg-accent-soft text-accent"><Icon className="h-5 w-5" aria-hidden /></div>
      <h3 className="font-display relative mt-5 text-3xl text-ink">{title}</h3>
      <p className="relative mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-soft">{body}</p>
      <div className="relative mx-auto mt-7 grid max-w-lg grid-cols-4 gap-2">{["Macro-F1", "Balanced acc.", "Calibration", "Latency"].map((metric) => <div key={metric} className="rounded-lg border border-line bg-surface/75 px-2 py-3"><span className="block font-mono text-lg text-ink-muted">—</span><span className="mt-1 block text-[9px] text-ink-muted">{metric}</span></div>)}</div>
    </div>
  );
}

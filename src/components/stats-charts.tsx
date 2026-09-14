"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useStatistics } from "@/lib/hooks";
import { formatMs, formatPercent } from "@/lib/utils";

const ACCENT = "#2f5d50";
const MUTED = "#c9c6bb";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function StatsCharts() {
  const { data, isLoading, isError, error, refetch } = useStatistics();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState error={error} title="Could not load statistics" onRetry={() => refetch()} />;

  if (data.total_predictions === 0) {
    return (
      <EmptyState
        title="No statistics yet"
        description="Charts are computed from real stored predictions only. Run a few analyses and this page will populate itself."
        action={
          <Link href="/analyze" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Analyze an image →
          </Link>
        }
      />
    );
  }

  const confidenceBins = data.confidence_distribution.map((b) => ({ label: `${Math.round(b.bin_start * 100)}–${Math.round(b.bin_end * 100)}%`, count: b.count }));

  return (
    <div className="space-y-6">
      {data.mock_predictions > 0 ? (
        <p className="rounded-md border border-warn/25 bg-warn-soft px-4 py-2 text-xs text-warn">
          {data.mock_predictions} of {data.total_predictions} stored predictions were produced in demo (mock) mode and do not reflect a trained model.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total predictions" value={String(data.total_predictions)} hint={`${data.real_predictions} from trained models`} />
        <Kpi label="Unknown rate" value={`${data.unknown_percentage.toFixed(1)}%`} hint={`${data.unknown_count} rejected as unknown`} />
        <Kpi label="Mean confidence" value={data.mean_confidence !== null && data.mean_confidence !== undefined ? formatPercent(data.mean_confidence) : "—"} hint="calibrated" />
        <Kpi label="Mean latency" value={formatMs(data.mean_latency_ms)} hint={`inference ${formatMs(data.mean_inference_ms)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Predictions over time" description="Per day (UTC)" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.predictions_over_time} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#e2e0d8" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#7c837f" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#7c837f" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e0d8" }} />
                <Line type="monotone" dataKey="count" name="predictions" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="unknown_count" name="unknown" stroke="#a16207" strokeWidth={1.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Class distribution" description="Predicted classes (unknown shown separately)" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.class_distribution} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#e2e0d8" vertical={false} />
                <XAxis dataKey="display_name" tick={{ fontSize: 11 }} stroke="#7c837f" interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#7c837f" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e0d8" }} />
                <Bar dataKey="count" name="predictions" fill={ACCENT} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Confidence distribution" description="Calibrated confidence, 10 bins" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceBins} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#e2e0d8" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#7c837f" interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#7c837f" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e0d8" }} />
                <Bar dataKey="count" name="predictions" fill={MUTED} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Breakdown" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Confidence states</dt>
                <dd className="mt-1 space-y-1">
                  {Object.entries(data.confidence_levels).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize text-ink-soft">{k}</span>
                      <span className="tabular-nums">{v}</span>
                    </div>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Models used</dt>
                <dd className="mt-1 space-y-1">
                  {Object.entries(data.models_used).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="truncate font-mono text-xs text-ink-soft">{k}</span>
                      <span className="tabular-nums">{v}</span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

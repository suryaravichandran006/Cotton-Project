"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useClasses, useDeletePrediction, usePredictions } from "@/lib/hooks";
import type { PredictionListParams, PredictionSummary } from "@/lib/types";
import { cn, confidenceLevelMeta, formatDateTime, formatMs, formatPercent, formatRelative } from "@/lib/utils";

const PAGE_SIZE = 12;

function DeleteButton({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const del = useDeletePrediction();
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button variant="danger" size="sm" disabled={del.isPending} onClick={() => del.mutate(id, { onSuccess: onDeleted })}>
          {del.isPending ? "Deleting…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <Button variant="ghost" size="sm" aria-label={`Delete prediction ${id}`} onClick={() => setConfirming(true)}>
      <Trash2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

function Row({ item }: { item: PredictionSummary }) {
  const level = confidenceLevelMeta[item.confidence_level];
  return (
    <tr className="border-t border-line hover:bg-surface-muted/50">
      <td className="px-4 py-3">
        <Link href={`/results/${item.id}`} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- backend-hosted thumbnail */}
          <img src={item.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md border border-line object-cover" />
          <span className="min-w-0">
            <span className={cn("block truncate text-sm font-medium", item.is_unknown ? "text-danger" : "text-ink")}>{item.is_unknown ? "Unknown" : item.display_name}</span>
            <span className="block text-xs text-ink-muted">{item.is_unknown ? `closest: ${item.display_name}` : item.predicted_class}</span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">{formatPercent(item.confidence)}</td>
      <td className="px-4 py-3">
        <Badge tone={level.tone}>{level.label.replace(" confidence", "")}</Badge>
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft">
        <span title={formatDateTime(item.created_at)}>{formatRelative(item.created_at)}</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
        {item.model_name}
        {item.is_mock ? <Badge tone="warn" className="ml-2">mock</Badge> : null}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-ink-soft">{formatMs(item.total_ms)}</td>
      <td className="px-2 py-3 text-right">
        <DeleteButton id={item.id} />
      </td>
    </tr>
  );
}

function CardItem({ item }: { item: PredictionSummary }) {
  const level = confidenceLevelMeta[item.confidence_level];
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex gap-3">
        <Link href={`/results/${item.id}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- backend-hosted thumbnail */}
          <img src={item.image_url} alt="" loading="lazy" className="h-16 w-16 rounded-md border border-line object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/results/${item.id}`} className={cn("block truncate text-sm font-semibold", item.is_unknown ? "text-danger" : "text-ink")}>
            {item.is_unknown ? "Unknown" : item.display_name}
          </Link>
          <p className="text-xs text-ink-muted">
            {formatPercent(item.confidence)} · {formatRelative(item.created_at)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={level.tone}>{level.label.replace(" confidence", "")}</Badge>
            {item.is_mock ? <Badge tone="warn">mock</Badge> : null}
          </div>
        </div>
        <DeleteButton id={item.id} />
      </div>
    </li>
  );
}

export function HistoryTable() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<NonNullable<PredictionListParams["sort_by"]>>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [className, setClassName] = useState("");
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [search, setSearch] = useState("");

  const params: PredictionListParams = { page, page_size: PAGE_SIZE, sort_by: sortBy, order, class_name: className || undefined, is_unknown: unknownOnly ? true : undefined, search: search || undefined };
  const { data, isLoading, isError, error, refetch, isFetching } = usePredictions(params);
  const classes = useClasses();

  const resetPage = () => setPage(1);
  const hasFilters = Boolean(className || unknownOnly || search);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex-1 text-xs font-medium text-ink-soft">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="class or filename"
            className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm font-normal text-ink"
          />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Class
          <select
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              resetPage();
            }}
            className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm font-normal text-ink sm:w-44"
          >
            <option value="">All classes</option>
            {classes.data?.classes.map((c) => (
              <option key={c.class_name} value={c.class_name}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm font-normal text-ink sm:w-40">
            <option value="created_at">Date</option>
            <option value="confidence">Confidence</option>
            <option value="predicted_class">Class</option>
            <option value="total_ms">Latency</option>
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Order
          <select value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")} className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-2 text-sm font-normal text-ink sm:w-32">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={unknownOnly}
            onChange={(e) => {
              setUnknownOnly(e.target.checked);
              resetPage();
            }}
          />
          Unknown only
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} title="Could not load history" onRetry={() => refetch()} />
      ) : !data || data.total === 0 ? (
        <EmptyState
          title={hasFilters ? "No predictions match these filters" : "No predictions yet"}
          description={hasFilters ? "Try clearing the search or class filter." : "Analyse a cotton fibre image and it will appear here with its confidence, model and timing."}
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setClassName("");
                  setUnknownOnly(false);
                  setSearch("");
                  resetPage();
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link href="/analyze" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                Analyze an image →
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className={cn("hidden overflow-hidden rounded-lg border border-line bg-surface md:block", isFetching && "opacity-70")}>
            <table className="w-full text-left" data-testid="history-table">
              <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Prediction</th>
                  <th className="px-4 py-2.5 font-medium">Confidence</th>
                  <th className="px-4 py-2.5 font-medium">State</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Latency</th>
                  <th className="px-2 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className={cn("space-y-2 md:hidden", isFetching && "opacity-70")}>
            {data.items.map((item) => (
              <CardItem key={item.id} item={item} />
            ))}
          </ul>

          <div className="flex items-center justify-between text-sm text-ink-soft">
            <span>
              {data.total} prediction{data.total === 1 ? "" : "s"} · page {data.page} of {data.pages}
            </span>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

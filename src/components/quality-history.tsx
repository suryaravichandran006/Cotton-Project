"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { qualityApi, qualityModelName } from "@/lib/quality-api";
import { formatDateTime } from "@/lib/utils";

export function QualityHistory() {
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ["quality-history", page], queryFn: () => qualityApi.history(page), placeholderData: keepPreviousData });
  const deletion = useMutation({ mutationFn: qualityApi.delete, onSuccess: (_, id) => { setConfirmId(null); cache.removeQueries({ queryKey: ["quality-analysis", id] }); setPage(1); void cache.invalidateQueries({ queryKey: ["quality-history"] }); } });
  if (query.isPending) return <p role="status">Loading saved analyses…</p>;
  if (query.isError) return <ErrorState error={query.error} title="History unavailable" onRetry={() => void query.refetch()} />;
  return <div className="space-y-5">
    {deletion.isError ? <ErrorState error={deletion.error} title="Could not delete this analysis" /> : null}
    {!query.data.total ? <EmptyState title="No cotton-quality analyses yet" description="Take a photograph to create your first saved result." action={<ButtonLink href="/analyze">Analyze cotton</ButtonLink>} /> : <>
      <p className="text-sm text-ink-soft">{query.data.total} saved {query.data.total === 1 ? "analysis" : "analyses"}. Each result preserves the estimates and reference values shown at the time.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-line"><th scope="col" className="py-3">Photograph</th><th scope="col" className="py-3">Date</th><th scope="col" className="py-3">Model</th><th scope="col" className="py-3">Result</th><th scope="col" className="py-3">Actions</th></tr></thead><tbody>{query.data.items.map((row) => <tr key={row.id} className="border-b border-line"><th scope="row" className="max-w-64 py-4 pr-4 font-medium"><Link className="break-words text-accent underline underline-offset-4" href={`/quality/${row.id}`}>{row.original_filename ?? "Cotton photograph"}</Link></th><td className="py-4 pr-4">{formatDateTime(row.created_at)}</td><td className="py-4 pr-4">{qualityModelName(row.model)}</td><td className="py-4 pr-4">{row.status === "withheld" ? "Withheld" : "Experimental"}</td><td className="py-4">{confirmId === row.id ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="danger" disabled={deletion.isPending} onClick={() => deletion.mutate(row.id)}>Confirm delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button></div> : <Button size="sm" variant="ghost" onClick={() => setConfirmId(row.id)} aria-label={`Delete analysis ${row.original_filename ?? row.id}`}>Delete</Button>}</td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between"><Button variant="secondary" disabled={page === 1 || query.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button><p className="text-sm" aria-live="polite">Page {page} of {Math.max(1, Math.ceil(query.data.total / 20))}</p><Button variant="secondary" disabled={page * 20 >= query.data.total || query.isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
    </>}
  </div>;
}

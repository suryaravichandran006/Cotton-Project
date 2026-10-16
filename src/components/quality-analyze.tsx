"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { QualityResultContent } from "@/components/quality-result";
import { QualityEvaluation, QualityWorking } from "@/components/quality-evaluation";
import { qualityApi, qualityModelName } from "@/lib/quality-api";
import type { QualityResponse } from "@/lib/quality-types";

function saveResultUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("analysis", id); else url.searchParams.delete("analysis");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

export function QualityAnalyze({ initialAnalysisId = null }: { initialAnalysisId?: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<QualityResponse | null>(null);
  const [savedId, setSavedId] = useState<string | null>(initialAnalysisId);
  const resultRef = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const status = useQuery({ queryKey: ["quality-status"], queryFn: qualityApi.status, staleTime: 30000 });
  const saved = useQuery({ queryKey: ["quality-analysis", savedId], queryFn: () => qualityApi.analysis(savedId!), enabled: Boolean(savedId), retry: 1 });
  const mutation = useMutation({ mutationFn: qualityApi.analyze, onSuccess: (data) => {
    cache.setQueryData(["quality-analysis", data.id], data);
    void cache.invalidateQueries({ queryKey: ["quality-history"] });
    setResult(data); setSavedId(data.id); saveResultUrl(data.id);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }});
  const currentResult = result ?? (savedId ? saved.data : undefined);
  const ready = status.data?.status === "ready";
  const chooseFile = (next: File | null) => { setFile(next); setResult(null); setSavedId(null); mutation.reset(); saveResultUrl(null); };

  return <div className="space-y-12">
    <form className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={(event) => { event.preventDefault(); if (file && ready && !mutation.isPending) mutation.mutate(file); }} aria-busy={mutation.isPending}>
      <div className="min-w-0"><h2 className="mb-4 text-xl font-semibold">Choose a cotton photograph</h2><UploadDropzone file={file} onFileChange={chooseFile} disabled={mutation.isPending} title="Choose a cotton photograph." description="Drop a photo here, choose a file, or use your phone’s camera." /></div>
      <aside className="space-y-5 lg:pt-11">
        <div className="border-y border-line py-5"><h2 className="text-lg font-semibold">What the result shows</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-soft"><li>The closest known reference: T1–T10.</li><li>That reference’s recorded lab values and CSV.</li><li>Separate experimental property estimates.</li></ol></div>
        {status.isPending ? <p role="status" className="text-sm text-ink-soft">Checking the model…</p> : null}
        {status.isError ? <ErrorState error={status.error} title="Model status unavailable" onRetry={() => void status.refetch()} /> : null}
        {status.data ? <div><p className="font-semibold">{ready ? qualityModelName(status.data.model ?? "") : "Model unavailable"}</p><p className="mt-2 text-sm leading-6 text-ink-soft">{ready ? `${status.data.training_images} loose-fibre photos across ${status.data.independent_lots} reference lots.` : status.data.message}</p></div> : null}
        <Button type="submit" size="lg" className="w-full" disabled={!file || !ready || mutation.isPending}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Analyzing cotton…</> : "Analyze cotton"}</Button>
        <p className="text-sm leading-6 text-ink-soft">Use loose cotton filling the frame, with even light and no ruler. T1–T10 are reference lot IDs; a visual match does not verify origin.</p>
        {mutation.isPending ? <p role="status" className="text-sm leading-6 text-ink-soft">Checking the photo → extracting features → matching a reference → estimating properties → saving the result.</p> : null}
        {mutation.isError ? <ErrorState error={mutation.error} title="Analysis could not finish" onRetry={() => { if (file) mutation.mutate(file); }} /> : null}
        <Link href="/quality/history" className="inline-flex min-h-10 items-center text-sm font-semibold text-accent underline underline-offset-4">Open saved analyses</Link>
      </aside>
    </form>
    <div ref={resultRef} className="scroll-mt-24" aria-live="polite" aria-busy={mutation.isPending}>
      {savedId && saved.isPending && !result ? <p role="status">Loading your saved result…</p> : null}
      {savedId && saved.isError && !result ? <ErrorState error={saved.error} title="Saved result unavailable" onRetry={() => void saved.refetch()} /> : null}
      {currentResult ? <QualityResultContent key={currentResult.id} result={currentResult} embedded /> : null}
    </div>
    {status.data?.status === "ready" ? <>{currentResult && currentResult.model.version !== status.data.version ? <p className="border-t border-line pt-4 text-sm leading-6 text-ink-soft">This saved result used an earlier model version. The working and evaluation below describe the currently installed model.</p> : null}<QualityWorking status={status.data} /><QualityEvaluation status={status.data} /></> : null}
  </div>;
}

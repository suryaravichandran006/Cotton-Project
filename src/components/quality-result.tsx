"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { qualityApi, qualityModelName } from "@/lib/quality-api";
import type { QualityResponse } from "@/lib/quality-types";
import { cn, formatDateTime } from "@/lib/utils";

function display(value: number | string | null | undefined, decimals: number) {
  return value == null ? "—" : typeof value === "number" ? value.toFixed(decimals) : value;
}

export function QualityResultContent({ result, embedded = false }: { result: QualityResponse; embedded?: boolean }) {
  const [view, setView] = useState<"recorded" | "estimated">("recorded");
  const reference = result.status === "withheld" ? null : result.reference;
  const trainedMatcher = reference && (reference.method ?? "cosine_centroid") !== "cosine_centroid";
  const recorded = view === "recorded" && Boolean(reference);
  const Heading = embedded ? "h2" : "h1";
  const title = reference ? `Matched reference: ${reference.lot_id}` : "Retake your cotton photograph.";
  const changeTab = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "recorded" : event.key === "End" ? "estimated" : view === "recorded" ? "estimated" : "recorded";
    setView(next);
    document.getElementById(`tab-${next}-${result.id}`)?.focus();
  };

  return (
    <section className="scroll-mt-24 space-y-8" aria-label="Cotton analysis result">
      <div className="grid items-start gap-8 border-y border-line py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="text-base font-semibold text-accent">{reference ? trainedMatcher ? "Cotton sample type · trained reference match" : "Cotton sample type · closest known lot" : "Photo check unsuccessful"}</p>
          <Heading className="font-display mt-3 text-4xl leading-tight text-ink sm:text-6xl" data-testid="matched-type">{title}</Heading>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            {reference
              ? `${reference.lot_id} is ${trainedMatcher ? "the classifier’s matched known reference" : "the closest visual reference"}. The lab table contains this lot’s recorded report averages; it is not a new laboratory test of your photograph.`
              : result.capture.reasons.join(" ") || "This capture falls outside the reference images. Use a close, evenly lit photograph of loose cotton."}
          </p>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4 text-sm">
            {reference?.matcher_name ? <div><dt className="text-ink-muted">Reference matcher</dt><dd className="mt-1 font-semibold">{reference.matcher_name}</dd></div> : null}
            <div><dt className="text-ink-muted">Property model</dt><dd className="mt-1 font-semibold">{qualityModelName(result.model.name)}</dd></div>
            <div><dt className="text-ink-muted">Server analysis time</dt><dd className="mt-1 font-semibold tabular-nums">{result.total_ms.toFixed(0)} ms</dd></div>
            {reference ? <div><dt className="text-ink-muted">Lab report</dt><dd className="mt-1 font-semibold">Page {reference.report.report_page} · {reference.report.report_date}</dd></div> : null}
            {reference ? <div><dt className="text-ink-muted">Visual distance · lower is closer</dt><dd className="mt-1 font-semibold tabular-nums">{reference.cosine_distance.toFixed(3)}</dd></div> : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            {reference ? <a className={buttonVariants({ variant: "primary" })} href={qualityApi.referenceCsvUrl(result.id)}>Download {reference.lot_id} lab CSV</a> : null}
            {embedded ? <Link className={buttonVariants({ variant: "secondary" })} href={`/quality/${result.id}`}>Open saved result</Link> : <ButtonLink href="/analyze" variant="secondary">Analyze another</ButtonLink>}
            <Link className="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-accent underline underline-offset-4" href="/quality/history">Saved analyses</Link>
          </div>
        </div>
        <figure className="overflow-hidden rounded-lg bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- validated backend image */}
          <img src={result.image.url} alt="Cotton photograph used for this analysis" className="aspect-[4/3] w-full object-cover" />
          <figcaption className="break-words p-3 text-xs leading-5 text-ink-soft">{result.image.original_filename ?? "Uploaded photograph"}</figcaption>
        </figure>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h3 className="font-display text-3xl">{recorded ? `${reference?.lot_id} lab profile` : "Model property estimates"}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{recorded ? "Recorded averages from four HVI test rows, with their reported standard deviations." : "Experimental values inferred from the photograph. MAE is an observed evaluation error, not a prediction interval."}</p></div>
          {reference ? <div role="tablist" aria-label="Result value source" className="flex rounded-lg border border-line-strong bg-surface p-1">
            <button id={`tab-recorded-${result.id}`} type="button" role="tab" tabIndex={view === "recorded" ? 0 : -1} aria-selected={view === "recorded"} aria-controls={`values-${result.id}`} onKeyDown={changeTab} onClick={() => setView("recorded")} className={cn("min-h-10 rounded-md px-4 text-sm font-medium", view === "recorded" ? "bg-accent text-white" : "text-ink-soft hover:bg-surface-muted")}>Recorded lab values</button>
            <button id={`tab-estimated-${result.id}`} type="button" role="tab" tabIndex={view === "estimated" ? 0 : -1} aria-selected={view === "estimated"} aria-controls={`values-${result.id}`} onKeyDown={changeTab} onClick={() => setView("estimated")} className={cn("min-h-10 rounded-md px-4 text-sm font-medium", view === "estimated" ? "bg-accent text-white" : "text-ink-soft hover:bg-surface-muted")}>Model estimates</button>
          </div> : null}
        </div>
        <div id={`values-${result.id}`} role="tabpanel" aria-label={recorded ? "Recorded lab profile" : "Experimental property estimates"} aria-labelledby={reference ? `tab-${view}-${result.id}` : undefined} tabIndex={0} className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm sm:text-base">
            <caption className="sr-only">{recorded ? "Recorded HVI laboratory averages" : "Experimental cotton property estimates"}</caption>
            <thead><tr className="border-b-2 border-line-strong"><th scope="col" className="py-3 pr-4">Parameter</th><th scope="col" className="py-3 pr-3">{recorded ? "Lab value" : "Estimate"}</th><th scope="col" className="py-3">{recorded ? "Lab SD" : "Observed MAE"}</th></tr></thead>
            <tbody>{result.properties.map((prop) => {
              const value = recorded ? prop.key === "grade" ? reference?.report.grade : reference?.report.average[prop.key] : prop.value;
              const variation = recorded ? reference?.report.reported_stddev[prop.key] : prop.observed_mae;
              return <tr key={prop.key} className="border-b border-line align-top">
                <th scope="row" className="py-4 pr-4 font-medium"><span className="block">{prop.code}</span><span className="mt-1 block text-xs font-normal leading-5 text-ink-muted">{prop.key === "amt" ? "Instrument field; meaning unconfirmed" : prop.label}</span></th>
                <td className="py-4 pr-3"><span className="text-lg font-semibold tabular-nums sm:text-xl" data-testid={`${recorded ? "lab" : "quality"}-${prop.key}`}>{display(value, prop.decimals)}</span>{value != null && prop.unit ? <span className="ml-1 text-xs text-ink-soft sm:text-sm">{prop.unit}</span> : null}{!recorded && value == null ? <p className="mt-1 text-xs text-ink-soft">{prop.status === "not_validated" ? "Not validated" : prop.status === "withheld" ? "Withheld" : "Not available"}</p> : null}</td>
                <td className="py-4 tabular-nums text-ink-soft">{display(variation, Math.max(2, prop.decimals))}{variation != null && prop.unit ? <span className="ml-1 text-xs sm:text-sm">{prop.unit}</span> : null}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!recorded ? <a className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-accent underline underline-offset-4" href={qualityApi.csvUrl(result.id)}>Download estimates CSV</a> : null}
        {reference ? <a href={`${qualityApi.reportUrl}#page=${reference.report.report_page}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-accent underline underline-offset-4">Open the original report, including all test rows and statistics</a> : null}
      </div>
      <details className="border-t border-line pt-4 text-sm leading-6 text-ink-soft"><summary className="cursor-pointer font-semibold text-accent">Model and data limits</summary><ul className="mt-3 list-disc space-y-2 pl-5">{result.warnings.map((text) => <li key={text}>{text}</li>)}</ul><p className="mt-3">Saved {formatDateTime(result.created_at)}. Reference matches are visual comparisons; T1–T10 identify source lots.</p></details>
    </section>
  );
}

export function QualityResult({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["quality-analysis", id], queryFn: () => qualityApi.analysis(id), retry: 1 });
  if (query.isPending) return <p role="status" className="py-12 text-ink-soft">Loading your saved cotton analysis…</p>;
  if (query.isError) return <ErrorState error={query.error} title="Analysis unavailable" onRetry={() => void query.refetch()} />;
  return <QualityResultContent result={query.data} />;
}

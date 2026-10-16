import type { Metadata } from "next";
import { Container } from "@/components/page-header";
import { QualityAnalyze } from "@/components/quality-analyze";
import { isAnalysisOnly } from "@/lib/analysis-deployment";

export const metadata: Metadata = { title: "Cotton analysis & measured results" };
export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ analysis?: string | string[] }> }) {
  const { analysis } = await searchParams;
  const initialAnalysisId = typeof analysis === "string" ? analysis : null;
  return <>
    <header className="border-b border-line bg-surface"><Container className="py-10 sm:py-12"><div className="flex flex-wrap items-end justify-between gap-6"><div className="max-w-3xl"><p className="text-sm font-semibold text-accent">Cotton Grade · reference matching & quality estimation</p><h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">Cotton analysis & measured results.</h1><p className="mt-4 text-base leading-7 text-ink-soft">Choose a photograph, inspect its closest T1–T10 reference and lab profile, then explore the model’s working and evaluation below.</p></div><nav aria-label="Analysis page sections" className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-accent"><a href="#working" className="underline underline-offset-4">How it works</a><a href="#model-results" className="underline underline-offset-4">Measured results</a></nav></div></Container></header>
    <Container className="py-10 sm:py-12"><QualityAnalyze initialAnalysisId={initialAnalysisId} singlePage={isAnalysisOnly()} /></Container>
  </>;
}

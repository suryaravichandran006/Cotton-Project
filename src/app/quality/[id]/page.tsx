import type { Metadata } from "next";
import { Container } from "@/components/page-header";
import { QualityResult } from "@/components/quality-result";

export const metadata: Metadata = { title: "Cotton quality analysis" };
export default async function QualityResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Container className="py-10 sm:py-14"><QualityResult id={id} /></Container>;
}

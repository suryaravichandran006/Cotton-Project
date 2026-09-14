import type { Metadata } from "next";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Result" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultView id={id} />;
}

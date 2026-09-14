import type { Metadata } from "next";
import { StatsCharts } from "@/components/stats-charts";
import { Container, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Statistics" };

export default function StatisticsPage() {
  return (
    <>
      <PageHeader eyebrow="Statistics" title="Usage statistics" description="Aggregates computed from stored predictions only — nothing here is simulated." />
      <Container className="py-8">
        <StatsCharts />
      </Container>
    </>
  );
}

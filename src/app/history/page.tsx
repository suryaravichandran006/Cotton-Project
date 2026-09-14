import type { Metadata } from "next";
import { HistoryTable } from "@/components/history-table";
import { Container, PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Prediction history"
        description="Every analysis is stored with its image, calibrated confidence, model version and timing. Select a row for the full result."
        actions={
          <ButtonLink href="/statistics" variant="secondary" size="sm">
            Statistics
          </ButtonLink>
        }
      />
      <Container className="py-8">
        <HistoryTable />
      </Container>
    </>
  );
}

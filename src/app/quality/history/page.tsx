import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QualityHistory } from "@/components/quality-history";

export const metadata: Metadata = { title: "Saved cotton-quality analyses" };
export default function QualityHistoryPage() {
  return <><PageHeader title="Your cotton analyses." description="Revisit experimental estimates and their original reference evidence." actions={<ButtonLink href="/analyze">Analyze cotton</ButtonLink>} /><Container className="py-10"><QualityHistory /></Container></>;
}

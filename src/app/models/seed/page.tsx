import type { Metadata } from "next";
import { StageModelStory } from "@/components/stage-model-story";

export const metadata: Metadata = { title: "Seed Model" };

export default function SeedModelPage() {
  return <StageModelStory stageId="seed" />;
}

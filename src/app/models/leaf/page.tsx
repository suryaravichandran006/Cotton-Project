import type { Metadata } from "next";
import { StageModelStory } from "@/components/stage-model-story";

export const metadata: Metadata = { title: "Leaf Model" };

export default function LeafModelPage() {
  return <StageModelStory stageId="leaf" />;
}

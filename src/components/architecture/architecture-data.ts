import {
  EXPERIMENT_ROUTES,
  datasetById,
  formatCount,
  formatPercent,
  stageResultById,
} from "@/lib/research";

export type ArchitectureStage = {
  id: "leaf" | "seed";
  number: 1 | 2;
  title: string;
  href: string;
  status: "Complete";
  nodes: Array<{
    kind: "dataset" | "process" | "model" | "output";
    title: string;
    detail: string;
  }>;
};

export type ArchitectureRoute = {
  id: string;
  label: string;
  path: string;
};

export type ArchitectureViewModel = {
  stages: [ArchitectureStage, ArchitectureStage];
  verifiedTransfer: {
    tensors?: number;
    replaced?: number;
  };
  finalExperiment: {
    datasetStatus: "Pending";
    datasetDetail: string;
    classCount: number;
    routes: ArchitectureRoute[];
  };
};

const routeLabels: Record<string, string> = {
  baseline: "Baseline",
  leaf_to_final: "Leaf Transfer",
  seed_to_final: "Seed Transfer",
  progressive: "Progressive",
};

export function getArchitectureViewModel(): ArchitectureViewModel {
  const leafDataset = datasetById("leaf");
  const seedDataset = datasetById("seed");
  const finalDataset = datasetById("final");
  const leafResult = stageResultById("leaf");
  const seedResult = stageResultById("seed");
  const seedTransfer = seedResult.transfer;
  const tensors = "transferred_tensors" in seedTransfer ? seedTransfer.transferred_tensors : undefined;
  const replaced = "skipped_task_tensors" in seedTransfer ? seedTransfer.skipped_task_tensors : undefined;

  return {
    stages: [
      {
        id: "leaf",
        number: 1,
        title: "Cotton Leaves",
        href: "/models/leaf",
        status: "Complete",
        nodes: [
          { kind: "dataset", title: "Leaf Images", detail: `${formatCount(leafResult.training_ready_images)} images` },
          { kind: "process", title: "Preprocess", detail: "224 × 224 RGB" },
          { kind: "model", title: leafResult.architecture, detail: `${leafDataset.classes}-class head` },
          { kind: "output", title: "Checkpoint", detail: `${formatPercent(leafResult.test.macro_f1)} Macro-F1` },
        ],
      },
      {
        id: "seed",
        number: 2,
        title: "Cotton Seeds",
        href: "/models/seed",
        status: "Complete",
        nodes: [
          { kind: "dataset", title: "Seed Images", detail: `${formatCount(seedResult.training_ready_images)} images` },
          { kind: "process", title: "Preprocess", detail: "224 × 224 RGB" },
          { kind: "model", title: seedResult.architecture, detail: `${seedDataset.classes}-class head` },
          { kind: "output", title: "Checkpoint", detail: `${formatPercent(seedResult.test.macro_f1)} Macro-F1` },
        ],
      },
    ],
    verifiedTransfer: { tensors, replaced },
    finalExperiment: {
      datasetStatus: "Pending",
      datasetDetail: `${formatCount(finalDataset.images)} candidate images · access pending`,
      classCount: finalDataset.classes,
      routes: EXPERIMENT_ROUTES.map((route) => ({
        id: route.id,
        label: routeLabels[route.id] ?? route.label,
        path: route.path.join(" → "),
      })),
    },
  };
}

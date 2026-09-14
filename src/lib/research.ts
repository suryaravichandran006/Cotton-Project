import researchConfig from "../../config/research.json";

export type ResearchDataset = (typeof researchConfig.datasets)[number];
export type TrainingStage = (typeof researchConfig.training_stages)[number];
export type StageResult = (typeof researchConfig.stage_results)[number];
export type ExperimentRoute = (typeof researchConfig.experiment_routes)[number];

export const RESEARCH = researchConfig;
export const DATASETS = researchConfig.datasets;
export const TRAINING_STAGES = researchConfig.training_stages;
export const STAGE_RESULTS = researchConfig.stage_results;
export const EXPERIMENT_ROUTES = researchConfig.experiment_routes;

export function datasetById(id: string): ResearchDataset {
  const dataset = DATASETS.find((item) => item.id === id);
  if (!dataset) throw new Error(`Unknown research dataset: ${id}`);
  return dataset;
}

export function stageById(id: string): TrainingStage {
  const stage = TRAINING_STAGES.find((item) => item.id === id);
  if (!stage) throw new Error(`Unknown training stage: ${id}`);
  return stage;
}

export function stageResultById(id: string): StageResult {
  const result = STAGE_RESULTS.find((item) => item.id === id);
  if (!result) throw new Error(`Unknown stage result: ${id}`);
  return result;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

import { z } from "zod";

export const confidenceLevelSchema = z.enum(["high", "medium", "low", "unknown"]);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const varietyInfoSchema = z.object({
  class_name: z.string(),
  display_name: z.string(),
  scientific_name: z.string().nullish(),
  designation: z.string().nullish(),
  region: z.string().nullish(),
  staple_category: z.string().nullish(),
  staple_length_mm: z.number().nullish(),
  micronaire: z.number().nullish(),
  strength_g_tex: z.number().nullish(),
  description: z.string().nullish(),
  source: z.string().nullish(),
  characteristics: z.array(z.string()).default([]),
  notes: z.string().nullish(),
  demo_placeholder: z.boolean().default(false),
  has_info: z.boolean().default(true),
});
export type VarietyInfo = z.infer<typeof varietyInfoSchema>;

export const predictionResponseSchema = z.object({
  id: z.string(),
  status: z.literal("success"),
  is_mock: z.boolean(),
  created_at: z.string(),
  model: z.object({
    name: z.string(),
    version: z.string(),
    architecture: z.string(),
    device: z.string(),
    is_mock: z.boolean(),
  }),
  prediction: z.object({
    class_name: z.string(),
    display_name: z.string(),
    confidence: z.number(),
    raw_probability: z.number(),
    confidence_level: confidenceLevelSchema,
    is_unknown: z.boolean(),
    unknown_reason: z.string().nullish(),
  }),
  top_predictions: z.array(
    z.object({
      rank: z.number(),
      class_name: z.string(),
      display_name: z.string(),
      calibrated_confidence: z.number(),
      raw_probability: z.number(),
    }),
  ),
  explanation: z.object({
    requested: z.boolean(),
    available: z.boolean(),
    gradcam_url: z.string().nullish(),
    error: z.string().nullish(),
    note: z.string().nullish(),
  }),
  processing: z.object({
    preprocess_ms: z.number(),
    inference_ms: z.number(),
    explainability_ms: z.number(),
    total_ms: z.number(),
    device: z.string(),
  }),
  image: z.object({
    url: z.string(),
    original_filename: z.string().nullish(),
    width: z.number().nullish(),
    height: z.number().nullish(),
    size_bytes: z.number().nullish(),
    format: z.string().nullish(),
  }),
  variety: varietyInfoSchema.nullish(),
  ood: z.object({ strategy: z.string(), scores: z.record(z.string(), z.number()).default({}) }),
  warnings: z.array(z.string()).default([]),
  client_metadata: z.record(z.string(), z.unknown()).nullish(),
});
export type PredictionResponse = z.infer<typeof predictionResponseSchema>;

export const predictionSummarySchema = z.object({
  id: z.string(),
  created_at: z.string(),
  predicted_class: z.string(),
  display_name: z.string(),
  confidence: z.number(),
  confidence_level: confidenceLevelSchema,
  is_unknown: z.boolean(),
  is_mock: z.boolean(),
  model_name: z.string(),
  model_version: z.string(),
  total_ms: z.number().nullish(),
  image_url: z.string(),
  gradcam_url: z.string().nullish(),
});
export type PredictionSummary = z.infer<typeof predictionSummarySchema>;

export const paginatedPredictionsSchema = z.object({
  items: z.array(predictionSummarySchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  pages: z.number(),
});
export type PaginatedPredictions = z.infer<typeof paginatedPredictionsSchema>;

export const activeModelSchema = z.object({
  mode: z.enum(["mock", "trained"]),
  status: z.enum(["ready", "error", "loading"]),
  is_mock: z.boolean(),
  model_name: z.string().nullish(),
  model_version: z.string().nullish(),
  architecture: z.string().nullish(),
  device: z.string().nullish(),
  num_classes: z.number().nullish(),
  class_names: z.array(z.string()).default([]),
  image_size: z.number().nullish(),
  calibration_temperature: z.number().nullish(),
  ood: z.record(z.string(), z.unknown()).nullish(),
  num_parameters: z.number().nullish(),
  registry_entry: z.record(z.string(), z.unknown()).nullish(),
  error: z.string().nullish(),
  message: z.string(),
});
export type ActiveModel = z.infer<typeof activeModelSchema>;

export const registryModelSchema = z.object({
  name: z.string(),
  version: z.string(),
  architecture: z.string(),
  checkpoint: z.string(),
  class_names: z.array(z.string()),
  image_size: z.number(),
  calibration_temperature: z.number().nullish(),
  ood: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  trained_at: z.string().nullish(),
  registered_at: z.string().nullish(),
  git_commit: z.string().nullish(),
  description: z.string(),
  size_mb: z.number().nullish(),
  is_active: z.boolean(),
  checkpoint_exists: z.boolean(),
});
export const modelsResponseSchema = z.object({
  registry_path: z.string(),
  active_model: z.string().nullish(),
  mode: z.enum(["mock", "trained"]),
  models: z.array(registryModelSchema),
});
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;

export const classesResponseSchema = z.object({
  num_classes: z.number(),
  source: z.enum(["registry", "mock_config", "fallback_config"]),
  is_mock: z.boolean(),
  classes: z.array(
    z.object({
      index: z.number(),
      class_name: z.string(),
      display_name: z.string(),
      variety: varietyInfoSchema.nullish(),
    }),
  ),
});
export type ClassesResponse = z.infer<typeof classesResponseSchema>;

export const statisticsSchema = z.object({
  total_predictions: z.number(),
  mock_predictions: z.number(),
  real_predictions: z.number(),
  unknown_count: z.number(),
  unknown_percentage: z.number(),
  mean_confidence: z.number().nullish(),
  mean_latency_ms: z.number().nullish(),
  mean_inference_ms: z.number().nullish(),
  predictions_over_time: z.array(z.object({ date: z.string(), count: z.number(), unknown_count: z.number() })),
  class_distribution: z.array(z.object({ class_name: z.string(), display_name: z.string(), count: z.number() })),
  confidence_distribution: z.array(z.object({ bin_start: z.number(), bin_end: z.number(), count: z.number() })),
  confidence_levels: z.record(z.string(), z.number()),
  models_used: z.record(z.string(), z.number()),
  first_prediction_at: z.string().nullish(),
  last_prediction_at: z.string().nullish(),
});
export type Statistics = z.infer<typeof statisticsSchema>;

export const systemInfoSchema = z.object({
  app: z.string(),
  version: z.string(),
  environment: z.string(),
  python_version: z.string(),
  platform: z.string(),
  torch_version: z.string().nullish(),
  cuda_available: z.boolean().nullish(),
  mps_available: z.boolean().nullish(),
  device: z.string().nullish(),
  mode: z.enum(["mock", "trained"]),
  model_status: z.string(),
  max_upload_mb: z.number(),
  supported_formats: z.array(z.string()),
  database_backend: z.string(),
  storage_backend: z.string(),
  uptime_seconds: z.number(),
});
export type SystemInfo = z.infer<typeof systemInfoSchema>;

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  mode: z.enum(["mock", "trained"]),
  model_status: z.string(),
  database: z.enum(["ok", "error"]),
  version: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().nullish() }),
  request_id: z.string().nullish(),
});

export interface PredictionListParams {
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "confidence" | "predicted_class" | "total_ms";
  order?: "asc" | "desc";
  class_name?: string;
  is_unknown?: boolean;
  is_mock?: boolean;
  min_confidence?: number;
  search?: string;
}

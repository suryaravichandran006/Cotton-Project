import { z } from "zod";

const labReferenceSchema = z.object({
  lot_id: z.string(), report_page: z.number().int(), report_date: z.string(), test_count: z.number().int(),
  average: z.record(z.string(), z.union([z.number(), z.string()])),
  reported_stddev: z.record(z.string(), z.number()), grade: z.string().nullable(),
});
const propertySchema = z.object({
  key: z.string(), label: z.string(), code: z.string(), unit: z.string().nullable(), decimals: z.number(),
  value: z.union([z.number(), z.string()]).nullable(),
  status: z.enum(["experimental_estimate", "withheld", "not_available", "not_validated"]),
  observed_mae: z.number().nullable(), beats_mean_baseline: z.boolean(), note: z.string(),
});
const metricSchema = z.object({ mae: z.number(), rmse: z.number(), beats_mean_baseline: z.boolean().optional() });
export const qualityStatusSchema = z.object({
  status: z.enum(["ready", "not_trained", "error"]), experimental: z.literal(true),
  model: z.string().nullable(), version: z.string().nullable(), label_status: z.string(),
  independent_lots: z.number(), training_images: z.number(), selection_rule: z.string().nullable(), evaluation_scope: z.string().nullable(),
  comparison: z.array(z.object({ model: z.string(), validation_normalized_mae: z.number(), selected: z.boolean(),
    held_out_lot_count: z.number(), properties: z.record(z.string(), metricSchema), category_accuracy: z.record(z.string(), z.number()) })),
  matching: z.object({
    evaluation_kind: z.string().optional(), installed_model: z.string().optional(), installed_name: z.string().optional(),
    selection_rule: z.string().optional(), target_accuracy: z.number().optional(), target_met: z.boolean().optional(),
    comparison: z.array(z.object({ model: z.string(), name: z.string(), accuracy: z.number(), balanced_accuracy: z.number(), macro_f1: z.number(), selected: z.boolean() })).optional(),
    method: z.string(), scope: z.string(), accuracy: z.number(), balanced_accuracy: z.number(),
    macro_precision: z.number(), macro_recall: z.number(), macro_f1: z.number(),
    correct: z.number().int(), total: z.number().int(), fold_count: z.number().int(), labels: z.array(z.string()),
    confusion_matrix: z.array(z.array(z.number().int())),
    per_lot: z.record(z.string(), z.object({ precision: z.number(), recall: z.number(), f1: z.number(), support: z.number().int() })),
  }).nullable().optional().default(null),
  protocol: z.object({ encoder: z.string().optional(), spatial_steps: z.number().optional(), numeric_outputs: z.number().optional(),
    transfer_learning: z.object({ route: z.string(), stages: z.array(z.string()), transferred_tensors: z.number(),
      source_checkpoint_sha256: z.string(), exported_backbone_sha256: z.string() }).nullable().optional(),
    matching_model: z.string().optional(), matching_image_size: z.number().optional(),
    matching_encoder: z.string().optional(), matching_resolutions: z.array(z.number()).optional(),
    regression_fold_count: z.number().optional(), final_epochs: z.number().nullable().optional() }).optional().default({}),
  limitations: z.array(z.string()), message: z.string(),
});
export const qualityResponseSchema = z.object({
  id: z.string(), created_at: z.string(), status: z.enum(["experimental", "withheld"]), withheld_reason: z.string().nullable(),
  model: z.object({ name: z.string(), version: z.string(), experimental: z.literal(true), label_status: z.string(), independent_lots: z.number() }),
  properties: z.array(propertySchema),
  capture: z.object({ passed: z.boolean(), brightness: z.number(), focus_score: z.number(), reasons: z.array(z.string()), scope: z.string() }),
  reference: z.object({ lot_id: z.string(), cosine_distance: z.number(), identity_verified: z.literal(false), method: z.string().optional(), matcher_name: z.string().optional(), note: z.string(), report: labReferenceSchema }).nullable(),
  warnings: z.array(z.string()), label_fingerprint: z.string(),
  image: z.object({ url: z.string(), original_filename: z.string().nullable(), width: z.number().nullable(), height: z.number().nullable(), size_bytes: z.number().nullable(), format: z.string().nullable() }),
  total_ms: z.number(),
});
export const labReferencesSchema = z.object({ label_status: z.string(), label_fingerprint: z.string(), limitations: z.array(z.string()), lots: z.array(labReferenceSchema) });
export const qualityHistorySchema = z.object({ total: z.number(), page: z.number(), page_size: z.number(), items: z.array(z.object({
  id: z.string(), created_at: z.string(), status: z.enum(["experimental", "withheld"]), model: z.string(), original_filename: z.string().nullable(),
})) });
export type QualityResponse = z.infer<typeof qualityResponseSchema>;
export type QualityStatus = z.infer<typeof qualityStatusSchema>;
export type LabReference = z.infer<typeof labReferenceSchema>;

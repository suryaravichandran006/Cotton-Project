import { API_V1, REQUEST_TIMEOUT_MS } from "@/lib/config";
import {
  activeModelSchema,
  apiErrorBodySchema,
  classesResponseSchema,
  healthSchema,
  modelsResponseSchema,
  paginatedPredictionsSchema,
  predictionResponseSchema,
  statisticsSchema,
  systemInfoSchema,
  type ActiveModel,
  type ClassesResponse,
  type Health,
  type ModelsResponse,
  type PaginatedPredictions,
  type PredictionListParams,
  type PredictionResponse,
  type Statistics,
  type SystemInfo,
} from "@/lib/types";
import type { ZodType } from "zod";

export type ApiErrorKind = "network" | "timeout" | "http" | "malformed";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number | null; code?: string; details?: unknown; requestId?: string | null } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status ?? null;
    this.code = opts.code ?? kind;
    this.details = opts.details;
    this.requestId = opts.requestId ?? null;
  }

  /** Human-friendly explanation shown in the UI. */
  get userMessage(): string {
    switch (this.code) {
      case "network":
      case "backend_unreachable":
        return "The Cotton Grade backend could not be reached. Start it with `make backend` (or check NEXT_PUBLIC_API_URL).";
      case "timeout":
      case "inference_timeout":
        return "The request timed out. The server may be busy or the image is very large — try again.";
      case "model_unavailable":
        return "No model is loaded on the server. Check the backend logs and the model registry.";
      case "file_too_large":
      case "image_too_large":
        return this.message;
      case "unsupported_media_type":
        return "That file is not a supported image. Upload a JPEG, PNG or WEBP photograph.";
      case "corrupt_image":
        return "The image could not be decoded — it may be corrupt or truncated.";
      case "not_found":
        return "That record does not exist (it may have been deleted).";
      case "malformed":
        return "The server returned an unexpected response. Backend and frontend versions may be out of sync.";
      default:
        return this.message || "Something went wrong.";
    }
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get("x-request-id");
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiError("http", parsed.data.error.message, { status: res.status, code: parsed.data.error.code, details: parsed.data.error.details, requestId });
  }
  const fallback = res.status === 502 || res.status === 503 || res.status === 504 ? "backend_unreachable" : `http_${res.status}`;
  return new ApiError("http", `Request failed with status ${res.status}`, { status: res.status, code: fallback, requestId });
}

async function request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_V1}${path}`, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("timeout", "Request timed out", { code: "timeout" });
    }
    throw new ApiError("network", "Backend unreachable", { code: "network" });
  }
  clearTimeout(timer);
  if (!res.ok) throw await parseError(res);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("malformed", "Response was not JSON", { status: res.status, code: "malformed" });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("malformed", "Response did not match the expected schema", { status: res.status, code: "malformed", details: parsed.error.issues });
  }
  return parsed.data;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: () => request<Health>("/health", healthSchema, {}, 8000),
  activeModel: () => request<ActiveModel>("/models/active", activeModelSchema, {}, 10000),
  models: () => request<ModelsResponse>("/models", modelsResponseSchema),
  classes: () => request<ClassesResponse>("/classes", classesResponseSchema),
  systemInfo: () => request<SystemInfo>("/system/info", systemInfoSchema),
  statistics: () => request<Statistics>("/statistics", statisticsSchema),
  predictions: (params: PredictionListParams = {}) => request<PaginatedPredictions>(`/predictions${qs({ ...params })}`, paginatedPredictionsSchema),
  prediction: (id: string) => request<PredictionResponse>(`/predictions/${encodeURIComponent(id)}`, predictionResponseSchema),
  deletePrediction: async (id: string) => {
    await request(`/predictions/${encodeURIComponent(id)}`, z_delete, { method: "DELETE" });
  },
  predict: (file: File, opts: { explain?: boolean; topK?: number; clientMetadata?: Record<string, unknown> } = {}) => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("client_metadata", JSON.stringify({ client: "web", user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined, ...opts.clientMetadata }));
    return request<PredictionResponse>(`/predict${qs({ explain: opts.explain ?? false, top_k: opts.topK })}`, predictionResponseSchema, { method: "POST", body: form });
  },
};

import { z } from "zod";
const z_delete = z.object({ id: z.string(), deleted: z.boolean() });

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError("network", err.message, { code: "network" });
  return new ApiError("network", "Unknown error", { code: "network" });
}

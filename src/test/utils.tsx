import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type { PredictionResponse, PredictionSummary } from "@/lib/types";

export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export function makePrediction(overrides: Partial<PredictionResponse> = {}): PredictionResponse {
  return {
    id: "abc123",
    status: "success",
    is_mock: true,
    created_at: "2025-01-01T10:00:00Z",
    model: { name: "mock-demo-predictor", version: "0.0.0-mock", architecture: "none (mock)", device: "cpu", is_mock: true },
    prediction: { class_name: "Giza_96", display_name: "Giza 96", confidence: 0.912, raw_probability: 0.95, confidence_level: "high", is_unknown: false, unknown_reason: null },
    top_predictions: [
      { rank: 1, class_name: "Giza_96", display_name: "Giza 96", calibrated_confidence: 0.912, raw_probability: 0.95 },
      { rank: 2, class_name: "Giza_86", display_name: "Giza 86", calibrated_confidence: 0.06, raw_probability: 0.03 },
      { rank: 3, class_name: "Giza_90", display_name: "Giza 90", calibrated_confidence: 0.02, raw_probability: 0.01 },
    ],
    explanation: { requested: true, available: true, gradcam_url: "http://api/files/gradcam/x.png", error: null, note: "Demo heatmap" },
    processing: { preprocess_ms: 3.2, inference_ms: 1.1, explainability_ms: 4.5, total_ms: 9.1, device: "cpu" },
    image: { url: "http://api/files/uploads/x.png", original_filename: "sample.png", width: 512, height: 512, size_bytes: 1234, format: "PNG" },
    variety: { class_name: "Giza_96", display_name: "Giza 96", designation: "placeholder", region: "Egypt (placeholder)", staple_category: "unverified", characteristics: [], notes: "Demo placeholder.", demo_placeholder: true, has_info: true },
    ood: { strategy: "confidence_threshold", scores: { max_calibrated_confidence: 0.912, threshold: 0.6 } },
    warnings: ["Demo prediction — trained model not yet installed."],
    client_metadata: null,
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<PredictionSummary> = {}): PredictionSummary {
  return {
    id: "abc123",
    created_at: new Date().toISOString(),
    predicted_class: "Giza_96",
    display_name: "Giza 96",
    confidence: 0.9,
    confidence_level: "high",
    is_unknown: false,
    is_mock: true,
    model_name: "mock-demo-predictor",
    model_version: "0.0.0-mock",
    total_ms: 8.2,
    image_url: "http://api/files/uploads/x.png",
    gradcam_url: null,
    ...overrides,
  };
}

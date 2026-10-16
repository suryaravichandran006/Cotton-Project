import { describe, expect, it } from "vitest";
import { isAnalysisRequestAllowed } from "@/lib/analysis-deployment";

const id = "a".repeat(32);
describe("analysis-only public routes", () => {
  it("allows the page, inference, result restoration and downloads", () => {
    for (const path of ["/", "/_next/static/chunks/app.js", "/api/backend/api/v1/quality/status", `/api/backend/api/v1/quality/analyses/${id}`, `/api/backend/api/v1/quality/analyses/${id}/reference.csv`, `/api/backend/api/v1/quality/analyses/${id}/csv`, "/api/backend/api/v1/quality/report", `/api/backend/files/uploads/${id}.jpg`]) {
      expect(isAnalysisRequestAllowed(path, "GET"), path).toBe(true);
    }
    expect(isAnalysisRequestAllowed("/api/backend/api/v1/quality/analyze", "POST")).toBe(true);
  });
  it("blocks research pages, private API listings, deletion and unrelated proxy targets", () => {
    for (const path of ["/architecture", "/models/leaf", "/models/seed", "/quality/history", `/quality/${id}`, "/api/backend/api/v1/quality/analyses", "/api/backend/api/v1/predictions", "/api/backend/docs", "/api/backend/openapi.json", "/api/backend/api/v1/system", `/api/backend/files/gradcam/${id}.jpg`]) {
      expect(isAnalysisRequestAllowed(path, "GET"), path).toBe(false);
    }
    expect(isAnalysisRequestAllowed(`/api/backend/api/v1/quality/analyses/${id}`, "DELETE")).toBe(false);
    expect(isAnalysisRequestAllowed("/api/backend/api/v1/quality/analyses/not-an-id", "GET")).toBe(false);
    expect(isAnalysisRequestAllowed("/api/backend/files/uploads/../secret", "GET")).toBe(false);
    expect(isAnalysisRequestAllowed("/api/backend/api/v1/quality/status", "POST")).toBe(false);
  });
});

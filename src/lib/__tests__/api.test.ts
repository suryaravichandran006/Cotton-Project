import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("api client error handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps structured backend errors to ApiError with code and request id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "file_too_large", message: "Image exceeds 10 MB" } }, 413, { "x-request-id": "req1" })));
    const err = await api.prediction("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("file_too_large");
    expect((err as ApiError).status).toBe(413);
    expect((err as ApiError).requestId).toBe("req1");
    expect((err as ApiError).userMessage).toBe("Image exceeds 10 MB");
  });

  it("treats network failures as backend-unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const err = await api.health().catch((e: unknown) => e);
    expect((err as ApiError).kind).toBe("network");
    expect((err as ApiError).userMessage).toMatch(/could not be reached/);
  });

  it("rejects malformed responses instead of rendering garbage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    const err = await api.activeModel().catch((e: unknown) => e);
    expect((err as ApiError).kind).toBe("malformed");
  });

  it("sends multipart predictions with explain/top_k query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "model_unavailable", message: "No model" } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    const err = await api.predict(new File([new Uint8Array(4)], "a.png", { type: "image/png" }), { explain: true, topK: 5 }).catch((e: unknown) => e);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/predict\?explain=true&top_k=5$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((err as ApiError).code).toBe("model_unavailable");
    expect((err as ApiError).userMessage).toMatch(/No model is loaded/);
  });
});

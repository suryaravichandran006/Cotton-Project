import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModeBanner } from "@/components/mode-banner";
import { ApiError } from "@/lib/api";
import { renderWithQuery } from "@/test/utils";

// A plain holder (not vi.fn) so rejected promises are not tracked by the spy machinery.
let impl: () => Promise<unknown> = () => Promise.resolve(null);
const activeModel = { mockReset: () => (impl = () => Promise.resolve(null)), mockResolvedValue: (v: unknown) => (impl = () => Promise.resolve(v)), mockReject: (e: unknown) => (impl = () => Promise.reject(e)), calls: 0 };
vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...mod,
    api: {
      ...mod.api,
      activeModel: () => {
        activeModel.calls += 1;
        return impl();
      },
    },
  };
});

const base = { mode: "mock", status: "ready", is_mock: true, class_names: ["A", "B"], message: "Demo mode — trained model not loaded." };

describe("ModeBanner", () => {
  beforeEach(() => activeModel.mockReset());

  it("announces demo mode when the backend runs the mock predictor", async () => {
    activeModel.mockResolvedValue(base);
    renderWithQuery(<ModeBanner />);
    await waitFor(() => expect(screen.getByTestId("mode-banner")).toHaveTextContent(/Demo Mode — Trained model not loaded/));
  });

  it("renders nothing for a healthy trained model", async () => {
    activeModel.mockResolvedValue({ ...base, mode: "trained", is_mock: false, model_name: "convnext_tiny_v1", message: "Serving trained model." });
    const { container } = renderWithQuery(<ModeBanner />);
    await waitFor(() => expect(activeModel.calls).toBeGreaterThan(0));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("explains when the backend is unreachable", async () => {
    activeModel.mockReject(new ApiError("network", "Backend unreachable", { code: "network" }));
    renderWithQuery(<ModeBanner />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Backend unreachable/));
  });

  it("surfaces model load errors", async () => {
    activeModel.mockResolvedValue({ ...base, mode: "trained", status: "error", is_mock: false, error: "Checkpoint not found", message: "Checkpoint not found" });
    renderWithQuery(<ModeBanner />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Model failed to load/));
  });
});

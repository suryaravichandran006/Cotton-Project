import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryTable } from "@/components/history-table";
import { ApiError } from "@/lib/api";
import { makeSummary, renderWithQuery } from "@/test/utils";

const predictions = vi.fn();
const deletePrediction = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...mod,
    api: {
      ...mod.api,
      predictions: (...args: unknown[]) => predictions(...args),
      deletePrediction: (...args: unknown[]) => deletePrediction(...args),
      classes: async () => ({ num_classes: 1, source: "fallback_config", is_mock: true, classes: [{ index: 0, class_name: "Giza_96", display_name: "Giza 96", variety: null }] }),
    },
  };
});

describe("HistoryTable", () => {
  beforeEach(() => {
    predictions.mockReset();
    deletePrediction.mockReset();
  });

  it("renders rows with prediction, confidence and model", async () => {
    predictions.mockResolvedValue({ items: [makeSummary(), makeSummary({ id: "u1", is_unknown: true, confidence_level: "unknown", confidence: 0.3, display_name: "Giza 86" })], total: 2, page: 1, page_size: 12, pages: 1 });
    renderWithQuery(<HistoryTable />);
    const table = await screen.findByTestId("history-table");
    expect(table).toHaveTextContent("Giza 96");
    expect(table).toHaveTextContent("90.0%");
    expect(table).toHaveTextContent("Unknown");
    expect(screen.getByText(/2 predictions/)).toBeInTheDocument();
  });

  it("shows an empty state when there is no history", async () => {
    predictions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 12, pages: 1 });
    renderWithQuery(<HistoryTable />);
    expect(await screen.findByText("No predictions yet")).toBeInTheDocument();
  });

  it("shows an error state when the backend fails", async () => {
    predictions.mockRejectedValue(new ApiError("http", "boom", { status: 500, code: "internal_error" }));
    renderWithQuery(<HistoryTable />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load history/);
  });

  it("requires confirmation before deleting", async () => {
    predictions.mockResolvedValue({ items: [makeSummary()], total: 1, page: 1, page_size: 12, pages: 1 });
    deletePrediction.mockResolvedValue(undefined);
    renderWithQuery(<HistoryTable />);
    await screen.findByTestId("history-table");
    fireEvent.click(screen.getAllByRole("button", { name: /delete prediction/i })[0]);
    expect(deletePrediction).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
    await waitFor(() => expect(deletePrediction).toHaveBeenCalledWith("abc123"));
  });

  it("passes filters to the API", async () => {
    predictions.mockResolvedValue({ items: [makeSummary()], total: 1, page: 1, page_size: 12, pages: 1 });
    renderWithQuery(<HistoryTable />);
    await screen.findByTestId("history-table");
    fireEvent.click(screen.getByLabelText(/unknown only/i));
    await waitFor(() => expect(predictions).toHaveBeenLastCalledWith(expect.objectContaining({ is_unknown: true, page: 1 })));
  });
});

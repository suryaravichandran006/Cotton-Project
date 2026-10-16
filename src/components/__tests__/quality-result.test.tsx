import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QualityResultContent } from "@/components/quality-result";
import type { QualityResponse } from "@/lib/quality-types";

const result: QualityResponse = {
  id: "analysis123", created_at: "2026-10-14T00:00:00Z", status: "experimental", withheld_reason: null,
  model: { name: "cnn_lstm", version: "fixture", experimental: true, label_status: "provisional_lot_average", independent_lots: 10 },
  properties: [
    { key: "micronaire", label: "Micronaire", code: "Mic", unit: null, decimals: 2, value: 4.2, status: "experimental_estimate", observed_mae: .5, beats_mean_baseline: false, note: "Synthetic test fixture." },
    { key: "colour_grade", label: "Colour grade", code: "CGrd", unit: null, decimals: 0, value: null, status: "not_validated", observed_mae: null, beats_mean_baseline: false, note: "No improvement over baseline." },
  ],
  capture: { passed: true, brightness: 140, focus_score: 50, reasons: [], scope: "Synthetic fixture" },
  reference: { lot_id: "T1", cosine_distance: .1, identity_verified: false, note: "Closest visual reference only; this does not identify the photographed lot.", report: { lot_id: "T1", report_page: 1, report_date: "2024-09-30", test_count: 4, average: { micronaire: 4.74, colour_grade: "21-1" }, reported_stddev: { micronaire: .11 }, grade: null } },
  warnings: ["Experimental estimates; not laboratory measurements."], label_fingerprint: "fixture",
  image: { url: "/sample.jpg", original_filename: "cotton.jpg", width: 1600, height: 1200, size_bytes: 1000, format: "JPEG" }, total_ms: 100,
};

describe("quality result evidence", () => {
  it("leads with the T label and its recorded profile, distinct from predictions", () => {
    render(<QualityResultContent result={result} embedded />);
    expect(screen.getByRole("heading", { name: "Matched reference: T1", level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("lab-micronaire")).toHaveTextContent("4.74");
    expect(screen.getByTestId("lab-colour_grade")).toHaveTextContent("21-1");
    expect(screen.queryByTestId("quality-micronaire")).not.toBeInTheDocument();
    expect(screen.getByText(/not a new laboratory test/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download T1 lab CSV/i })).toHaveAttribute("href", expect.stringContaining("analysis123/reference.csv"));
    expect(screen.getByRole("link", { name: /open the original report/i })).toHaveAttribute("href", expect.stringContaining("/quality/report#page=1"));
  });
  it("shows predictions separately and never fills unsupported predictions from the lab", () => {
    render(<QualityResultContent result={result} />);
    fireEvent.click(screen.getByRole("tab", { name: "Model estimates" }));
    expect(screen.getByTestId("quality-micronaire")).toHaveTextContent("4.20");
    expect(screen.getByTestId("quality-colour_grade")).toHaveTextContent("—");
    expect(screen.getByText("Not validated")).toBeInTheDocument();
    expect(screen.queryByTestId("lab-micronaire")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download estimates csv/i })).toHaveAttribute("href", expect.stringContaining("analysis123/csv"));
  });
  it("supports keyboard switching and restores the lab profile", () => {
    render(<QualityResultContent result={result} />);
    const recorded = screen.getByRole("tab", { name: "Recorded lab values" });
    recorded.focus();
    fireEvent.keyDown(recorded, { key: "ArrowRight" });
    const estimated = screen.getByRole("tab", { name: "Model estimates" });
    expect(estimated).toHaveFocus();
    expect(estimated).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(estimated, { key: "Home" });
    expect(recorded).toHaveFocus();
    expect(screen.getByTestId("lab-micronaire")).toHaveTextContent("4.74");
  });
  it("makes capture withholding actionable without a matched type or lab CSV", () => {
    render(<QualityResultContent result={{ ...result, status: "withheld", reference: result.reference, properties: result.properties.map((p) => ({ ...p, value: null, status: "withheld" })) }} />);
    expect(screen.getByRole("heading", { name: /retake your cotton photograph/i })).toBeInTheDocument();
    expect(screen.getByTestId("quality-micronaire")).toHaveTextContent("—");
    expect(screen.queryByRole("heading", { name: /matched reference/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lab CSV/i })).not.toBeInTheDocument();
  });
});

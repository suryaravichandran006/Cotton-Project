import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PredictionResult } from "@/components/prediction-result";
import { makePrediction } from "@/test/utils";

describe("PredictionResult", () => {
  it("renders the variety, calibrated confidence and top predictions", () => {
    render(<PredictionResult result={makePrediction({ is_mock: false, warnings: [] })} />);
    expect(screen.getByTestId("predicted-class")).toHaveTextContent("Giza 96");
    expect(screen.getAllByText("91.2%").length).toBeGreaterThan(0);
    const list = within(screen.getByTestId("top-predictions"));
    expect(list.getAllByRole("listitem")).toHaveLength(3);
    expect(list.getByText("Giza 86")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-notice")).not.toBeInTheDocument();
    expect(screen.getByText(/High confidence/)).toBeInTheDocument();
  });

  it("shows the demo-mode notice for mock predictions", () => {
    render(<PredictionResult result={makePrediction()} />);
    const notice = screen.getByTestId("mock-notice");
    expect(notice).toHaveTextContent(/Demo mode — no trained model loaded/i);
    expect(notice).toHaveTextContent(/Demo prediction — trained model not yet installed/);
    expect(screen.getByText(/Demo heatmap — not a model explanation/i)).toBeInTheDocument();
  });

  it("renders the unknown state without asserting a variety", () => {
    render(
      <PredictionResult
        result={makePrediction({
          is_mock: false,
          warnings: [],
          variety: null,
          prediction: { class_name: "Giza_90", display_name: "Giza 90", confidence: 0.41, raw_probability: 0.5, confidence_level: "unknown", is_unknown: true, unknown_reason: "calibrated confidence 0.410 below threshold 0.60" },
        })}
      />,
    );
    expect(screen.getByTestId("predicted-class")).toHaveTextContent(/Unknown \/ low confidence/);
    expect(screen.getByText(/Closest known class/)).toHaveTextContent("Giza 90");
    expect(screen.getByText(/No variety information is shown/)).toBeInTheDocument();
  });

  it("shows model, version and timing", () => {
    render(<PredictionResult result={makePrediction()} />);
    expect(screen.getByText("mock-demo-predictor")).toBeInTheDocument();
    expect(screen.getByText("0.0.0-mock")).toBeInTheDocument();
    expect(screen.getAllByText("9.1 ms").length).toBeGreaterThan(0);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { getArchitectureViewModel } from "@/components/architecture/architecture-data";

describe("ArchitectureDiagram", () => {
  it("presents the verified training lineage without inventing a final result", () => {
    render(<ArchitectureDiagram data={getArchitectureViewModel()} />);

    expect(screen.getByText("ImageNet-1K")).toBeInTheDocument();
    expect(screen.getByText("Stage 1 · Cotton Leaves")).toBeInTheDocument();
    expect(screen.getByText("98.80% Macro-F1")).toBeInTheDocument();
    expect(screen.getByText("Stage 2 · Cotton Seeds")).toBeInTheDocument();
    expect(screen.getByText("95.61% Macro-F1")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
    expect(screen.getByText("Best route will be selected")).toBeInTheDocument();
    expect(screen.queryByText("Best route selected")).not.toBeInTheDocument();
  });

  it("keeps intermediate models out of the production flow", () => {
    render(<ArchitectureDiagram data={getArchitectureViewModel()} />);

    const production = screen.getByRole("region", { name: "Production Inference" });
    expect(production).toHaveTextContent("Cotton Photo");
    expect(production).toHaveTextContent("FastAPI");
    expect(production).toHaveTextContent("Final Model");
    expect(production).not.toHaveTextContent("Leaf");
    expect(production).not.toHaveTextContent("Seed");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadDropzone, validateFile } from "@/components/upload-dropzone";

function file(name: string, type: string, size = 1024): File {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
}

describe("validateFile", () => {
  it("accepts supported images within the limit", () => {
    expect(validateFile(file("a.jpg", "image/jpeg"), 10)).toBeNull();
    expect(validateFile(file("a.webp", "image/webp"), 10)).toBeNull();
  });
  it("rejects unsupported types and oversized files", () => {
    expect(validateFile(file("a.gif", "image/gif"), 10)).toMatch(/Unsupported/);
    expect(validateFile(file("a.png", "image/png", 11 * 1024 * 1024), 10)).toMatch(/limit is 10 MB/);
    expect(validateFile(file("a.png", "image/png", 0), 10)).toMatch(/empty/);
  });
});

describe("UploadDropzone", () => {
  it("renders an accessible drop target and forwards a valid file", () => {
    const onChange = vi.fn();
    render(<UploadDropzone file={null} onFileChange={onChange} />);
    expect(screen.getByRole("button", { name: /upload a cotton fibre image/i })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file("cotton.png", "image/png")] } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "cotton.png" }));
  });

  it("shows a validation error and clears the selection for a bad file", () => {
    const onChange = vi.fn();
    render(<UploadDropzone file={null} onFileChange={onChange} />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file("doc.pdf", "application/pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Unsupported file type/);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("accepts dropped files", () => {
    const onChange = vi.fn();
    render(<UploadDropzone file={null} onFileChange={onChange} />);
    fireEvent.drop(screen.getByRole("button", { name: /upload a cotton fibre image/i }), { dataTransfer: { files: [file("drop.jpg", "image/jpeg")] } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "drop.jpg" }));
  });

  it("offers replace and remove once a file is selected", () => {
    const onChange = vi.fn();
    render(<UploadDropzone file={file("selected.png", "image/png")} onFileChange={onChange} />);
    expect(screen.getByText("selected.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove selected image/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  });
});

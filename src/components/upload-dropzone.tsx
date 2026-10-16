"use client";

import { Camera, ImagePlus, RefreshCw, ScanLine, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_MIME, MAX_UPLOAD_MB } from "@/lib/config";
import { cn, formatBytes } from "@/lib/utils";

export interface UploadDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  maxMb?: number;
  title?: string;
  description?: string;
}

export function validateFile(file: File, maxMb: number): string | null {
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return `Unsupported file type${file.type ? ` (${file.type})` : ""}. Use a JPEG, PNG or WEBP photograph.`;
  }
  if (file.size > maxMb * 1024 * 1024) return `File is ${formatBytes(file.size)}; the limit is ${maxMb} MB.`;
  if (file.size === 0) return "The file is empty.";
  return null;
}

export function UploadDropzone({ file, onFileChange, disabled = false, maxMb = MAX_UPLOAD_MB, title, description }: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const accept = useCallback((candidate: File | undefined | null) => {
    if (!candidate) return;
    const problem = validateFile(candidate, maxMb);
    setError(problem);
    onFileChange(problem ? null : candidate);
  }, [maxMb, onFileChange]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) accept(e.dataTransfer.files?.[0]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const clear = () => {
    setError(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  return (
    <div>
      <input ref={inputRef} id={inputId} data-testid="file-input" type="file" accept={ACCEPTED_MIME.join(",")} className="sr-only" disabled={disabled} onChange={(e) => accept(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(e) => accept(e.target.files?.[0])} aria-hidden tabIndex={-1} />

      {!file ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-describedby={`${inputId}-hint`}
          aria-label="Upload a cotton fibre image: click, press Enter, or drop a file"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={onKeyDown}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "paper-field group relative flex min-h-[420px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-6 py-12 text-center transition duration-200",
            dragging ? "border-accent bg-accent-soft/55 shadow-lift" : "border-line-strong bg-surface hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-card",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div className="soft-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden />
          <div className="cotton-glow pointer-events-none absolute h-56 w-56 opacity-60" aria-hidden />
          <div className="relative grid h-16 w-16 place-items-center rounded-full border border-accent/20 bg-surface/85 text-accent shadow-card backdrop-blur">
            <UploadCloud className="h-6 w-6" aria-hidden />
          </div>
          <p className="font-display relative mt-7 text-3xl text-ink">{title ?? "Place a fibre photograph on the instrument."}</p>
          <p className="relative mt-3 max-w-md text-sm leading-6 text-ink-soft">{description ?? "Drop a raw / ginned cotton image here or browse your device. The backend validates the actual image bytes before inference."}</p>
          <p id={`${inputId}-hint`} className="relative mt-3 font-mono text-[10px] text-ink-muted">JPEG · PNG · WEBP · up to {maxMb} MB</p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><ImagePlus className="h-4 w-4" aria-hidden /> Choose file</Button>
            <Button variant="ghost" size="sm" disabled={disabled} className="sm:hidden" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}><Camera className="h-4 w-4" aria-hidden /> Use camera</Button>
          </div>
          <div className="pointer-events-none absolute inset-x-16 bottom-10 h-px overflow-hidden bg-line" aria-hidden><span className="animate-cv-scan block h-px w-24 bg-accent/60" /></div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-ink">
            <div className="soft-grid pointer-events-none absolute inset-0 opacity-10" aria-hidden />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={previewUrl} alt={`Preview of ${file.name}`} className="relative max-h-[520px] w-full object-contain" />
            ) : null}
            <div className="pointer-events-none absolute inset-4 rounded-lg border border-white/15" aria-hidden />
            <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur" aria-hidden><ScanLine className="h-3.5 w-3.5" /> input preview</div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink" title={file.name}>{file.name}</p><p className="mt-1 text-[10px] font-mono text-ink-muted">{file.type.replace("image/", "").toUpperCase()} · {formatBytes(file.size)}</p></div>
            <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}><RefreshCw className="h-4 w-4" aria-hidden /> Replace</Button><Button variant="ghost" size="sm" disabled={disabled} onClick={clear} aria-label="Remove selected image"><Trash2 className="h-4 w-4" aria-hidden /> Remove</Button></div>
          </div>
        </div>
      )}

      {error ? <p role="alert" className="mt-3 rounded-lg border border-danger/15 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

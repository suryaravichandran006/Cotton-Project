"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { usePredictMutation, useActiveModel } from "@/lib/hooks";

const optionsSchema = z.object({
  explain: z.boolean(),
  topK: z.number().int().min(1).max(10),
});
type Options = z.infer<typeof optionsSchema>;

export function AnalyzeForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const mutation = usePredictMutation();
  const model = useActiveModel();
  const { register, handleSubmit, control } = useForm<Options>({ resolver: zodResolver(optionsSchema), defaultValues: { explain: true, topK: 3 } });
  const explain = useWatch({ control, name: "explain" });

  const busy = mutation.isPending;
  const modelBlocked = model.data?.status === "error";

  const onSubmit = handleSubmit((opts) => {
    if (!file) return;
    mutation.mutate(
      { file, explain: opts.explain, topK: opts.topK },
      { onSuccess: (data) => router.push(`/results/${data.id}`) },
    );
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy={busy}>
      <section aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="sr-only">Image upload</h2>
        <UploadDropzone file={file} onFileChange={setFile} disabled={busy} />
      </section>

      <aside className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line bg-surface-muted/45 px-5 py-4"><SlidersHorizontal className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold text-ink">Analysis controls</h2></div>
          <div className="p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" disabled={busy} {...register("explain")} />
              <span><span className="block text-sm font-semibold text-ink">Grad-CAM explanation</span><span className="mt-1 block text-xs leading-5 text-ink-muted">Generate a heatmap of fibre regions that influenced the final class score.</span></span>
            </label>
            <div className="my-5 h-px bg-line" />
            <label className="block">
              <span className="block text-sm font-semibold text-ink">Ranked classes</span>
              <span className="mt-1 block text-xs leading-5 text-ink-muted">How many alternatives should the result retain?</span>
              <select className="mt-3 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm" disabled={busy} {...register("topK", { valueAsNumber: true })}>
                {[1, 2, 3, 5].map((k) => <option key={k} value={k}>Top {k}</option>)}
              </select>
            </label>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={!file || busy || modelBlocked} className="w-full rounded-xl py-5 shadow-card">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {busy ? "Analysing…" : "Analyze cotton"}
        </Button>

        <div className="rounded-xl border border-line bg-surface-muted/35 p-4">
          <div className="flex items-center justify-between gap-4"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Runtime</span><span className={modelBlocked ? "text-[10px] font-semibold uppercase tracking-wide text-danger" : "text-[10px] font-semibold uppercase tracking-wide text-accent"}>{modelBlocked ? "blocked" : busy ? "processing" : "ready"}</span></div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">Upload → validate → preprocess → classify → calibrate → reject if OOD → {explain ? "explain → " : ""}store result.</p>
        </div>

        {busy ? <p role="status" className="text-xs leading-5 text-ink-muted">Running the active final model{explain ? " and generating Grad-CAM" : ""}. You will be taken to the result automatically.</p> : null}
        {modelBlocked ? <p className="text-xs text-danger">The backend reports that no model could be loaded; analysis is disabled until that is fixed.</p> : null}
        {mutation.isError ? <ErrorState error={mutation.error} title="Analysis failed" onRetry={file ? () => onSubmit() : undefined} /> : null}
        <p className="text-xs leading-5 text-ink-muted">Best capture: loose raw or ginned fibre, plain background, even light, cotton filling most of the frame. Leaves, plants and bolls are out of scope.</p>
      </aside>
    </form>
  );
}

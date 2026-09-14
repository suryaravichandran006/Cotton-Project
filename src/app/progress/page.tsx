import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Progress" };

const modules = [
  ["Dataset preparation", "Implemented", "Audit, duplicate review, fixed split manifests and training-only augmentation"],
  ["Progressive training", "Implemented", "ImageNet-to-leaf training and leaf-to-seed checkpoint initialization"],
  ["Evaluation", "Implemented", "Macro-F1, balanced accuracy, per-class metrics, confusion matrices and calibration"],
  ["Transfer evidence", "Implemented", "Checkpoint lineage and compatible-tensor transfer reports"],
  ["Research interface", "Implemented", "Panel-facing architecture, dataset and result surfaces backed by report data"],
  ["Final cultivar study", "Pending", "Dataset access, specimen-aware split, controlled routes and final model selection"],
] as const;

const refinements = [
  {
    problem: "Duplicate and conflicting leaf images",
    action: "Audited exact duplicates before creating the train, validation and test manifests.",
    evidence: "1,373 source images reduced to 1,124 unique, non-conflicting training-ready images.",
  },
  {
    problem: "Leaf and seed classifier heads have different output shapes",
    action: "Transferred only tensors with matching keys and shapes, then initialized a fresh seed task head.",
    evidence: "180 compatible tensors loaded; two leaf-head tensors skipped and replaced.",
  },
  {
    problem: "Public intermediate datasets have no specimen identifiers",
    action: "Reported results as image-level holdouts and reserved grouped specimen splitting for the final study.",
    evidence: "The limitation remains visible beside the results instead of being hidden by the headline scores.",
  },
] as const;

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        eyebrow="Implementation progress"
        title="What is working now, and what remains."
        description="The progressive training path has been executed through leaves and seeds. The final cultivar experiment remains deliberately pending until its dataset is available."
      />

      <Container className="space-y-16 py-12 sm:py-16">
        <section aria-labelledby="stage-progress">
          <div className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Research-stage progress</p>
              <h2 id="stage-progress" className="font-display mt-3 text-4xl leading-tight text-ink">Two stages measured. One final stage pending.</h2>
              <p className="mt-4 text-sm leading-7 text-ink-soft">This describes experimental stage completion, not a percentage of the approved project plan.</p>
            </div>

            <ol className="border-t border-line-strong">
              <ProgressRow number="01" title="Cotton leaf adaptation" status="Complete" detail="Audited, trained, evaluated and saved as the source checkpoint for seed adaptation." />
              <ProgressRow number="02" title="Cotton seed adaptation" status="Complete" detail="Initialized from the leaf checkpoint, trained, evaluated and saved for the final-stage handoff." />
              <ProgressRow number="03" title="Raw cotton cultivar study" status="Pending" detail="Candidate dataset identified; access, grouped split and four-route comparison remain." pending />
            </ol>
          </div>
        </section>

        <section aria-labelledby="working-modules">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Functional implementation</p>
            <h2 id="working-modules" className="font-display mt-3 text-4xl text-ink">Working modules and their evidence.</h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="hidden grid-cols-[0.8fr_0.42fr_1.5fr] bg-canvas px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:grid">
              <span>Module</span><span>Status</span><span>Evidence</span>
            </div>
            <div className="divide-y divide-line">
              {modules.map(([name, status, evidence]) => (
                <div key={name} className="grid gap-2 px-5 py-4 sm:grid-cols-[0.8fr_0.42fr_1.5fr] sm:items-center sm:px-6">
                  <p className="text-sm font-semibold text-ink">{name}</p>
                  <p className={status === "Pending" ? "text-xs font-semibold text-gold" : "text-xs font-semibold text-accent"}>{status}</p>
                  <p className="text-sm leading-6 text-ink-soft">{evidence}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="refinements">
          <div className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Technical refinement</p>
              <h2 id="refinements" className="font-display mt-3 text-4xl leading-tight text-ink">Problems found and corrected.</h2>
              <p className="mt-4 text-sm leading-7 text-ink-soft">Each refinement is tied to a concrete implementation or report artifact.</p>
            </div>

            <div className="divide-y divide-line border-y border-line">
              {refinements.map((item, index) => (
                <article key={item.problem} className="grid gap-4 py-6 sm:grid-cols-[44px_1fr]">
                  <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{item.problem}</h3>
                    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                      <div><dt className="font-semibold text-ink">Action</dt><dd className="mt-1 leading-6 text-ink-soft">{item.action}</dd></div>
                      <div><dt className="font-semibold text-ink">Evidence</dt><dd className="mt-1 leading-6 text-ink-soft">{item.evidence}</dd></div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Link href="/architecture" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong">
            Follow the architecture <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </>
  );
}

function ProgressRow({ number, title, status, detail, pending = false }: { number: string; title: string; status: string; detail: string; pending?: boolean }) {
  return (
    <li className="grid gap-3 border-b border-line py-5 sm:grid-cols-[44px_1fr_auto] sm:items-start">
      <span className="font-mono text-xs text-ink-muted">{number}</span>
      <div><p className="font-semibold text-ink">{title}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">{detail}</p></div>
      <span className={pending ? "text-xs font-semibold text-gold" : "text-xs font-semibold text-accent"}>{status}</span>
    </li>
  );
}

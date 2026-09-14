import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "About the project" };

const QA: [string, string][] = [
  ["Why these four models?", "They span the design space a reviewer expects: a canonical baseline (ResNet50), a compound-scaled network (EfficientNetV2-S), a modern large-kernel ConvNet (ConvNeXt-Tiny) and a mobile-first network (MobileNetV3-Large). Comparing them on identical splits answers 'is accuracy worth the compute?' for the deployment target."],
  ["Why macro-F1 rather than accuracy?", "Cultivar datasets are rarely balanced. Accuracy rewards a model that ignores a rare variety; macro-F1 and balanced accuracy weight every class equally, and per-class recall shows which cultivar is being missed."],
  ["How is data leakage prevented?", "Splits are stratified and, when sample/batch metadata exists, grouped so that all photographs of one physical specimen stay in the same split. Splits are saved as CSV and reused across experiments; the audit tool flags near-duplicates across classes."],
  ["Why calibrate confidence?", "Softmax outputs of fine-tuned CNNs are systematically over-confident. Temperature scaling fitted on the validation set makes the reported number meaningful, which is essential when the value drives an accept/reject decision."],
  ["Why Grad-CAM?", "It is architecture-agnostic for CNNs, cheap to compute and answers the practical question 'did the network look at fibre or at the background/label?'. It is a qualitative diagnostic, not a correctness proof — the UI says so."],
  ["How does unknown rejection work?", "A calibrated-confidence threshold rejects low-confidence inputs. The rejector is an interface, so energy-based, Mahalanobis or embedding-based detectors can be added and combined without touching the API."],
  ["Why transfer learning?", "Fibre datasets are small (hundreds to a few thousand images). ImageNet-pretrained features converge faster and generalise better than training from scratch; only the classifier head is re-initialised."],
  ["How is inference deployed?", "A FastAPI service loads the active model once at start-up, runs preprocessing → model → calibration → rejection → optional Grad-CAM inside torch.inference_mode, and stores each result. The Next.js app and a future mobile app are thin clients of that REST API."],
  ["How are model versions tracked?", "Every export writes metadata (architecture, classes, image size, normalisation, temperature, metrics, training date, git commit) and is added to models/registry.json. Switching models is a registry change plus restart — no code edits."],
  ["How will new cotton classes be supported?", "Add a folder per class under data/raw, re-run audit → split (--resplit) → train → export → register. Class names flow from the checkpoint into the registry and API automatically; variety metadata is optional decoration in config/varieties.yaml."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About" title="Deep Learning-Based Cotton Variety Identification from Raw Cotton Fibre Images" description="A final-year engineering project combining a reproducible ML pipeline, an API-first backend and a production-quality web client." />
      <Container className="grid gap-12 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Scope</h2>
            <p className="mt-2 text-[15px] leading-7 text-ink-soft">
              The system classifies photographs of <strong className="font-semibold text-ink">raw or ginned cotton fibre (lint)</strong> into cultivars. It explicitly does not address cotton leaves, flowers,
              plants, diseases, pests or bolls on the plant. The eventual class list (e.g. Giza 86/87/90/94/96, or Indian cultivars such as Shankar-6, MCU-5, DCH-32) is
              determined by the dataset; nothing in the code base assumes a particular set of varieties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Current status</h2>
            <p className="mt-2 text-[15px] leading-7 text-ink-soft">
              The complete pipeline — data audit, grouped splitting, augmentation, training, evaluation, calibration, export, registry, API,
              history, statistics and this interface — is implemented and tested. The leaf and seed stages have been trained with real reports. The final cotton
              cultivar dataset is still pending, so no final cultivar model or final-route performance claim exists. The service remains in demo mode until a validated final model is registered.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Design decisions, defended</h2>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {QA.map(([q, a]) => (
                <div key={q} className="grid gap-2 py-4 md:grid-cols-[260px_1fr]">
                  <dt className="text-sm font-semibold text-ink">{q}</dt>
                  <dd className="text-sm leading-6 text-ink-soft">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold text-ink">Stack</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              <li>PyTorch · timm · Albumentations · scikit-learn</li>
              <li>FastAPI · SQLAlchemy · Alembic · SQLite/PostgreSQL</li>
              <li>Next.js · TypeScript · Tailwind · TanStack Query</li>
              <li>pytest · Vitest · Playwright · Docker · GitHub Actions</li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold text-ink">Repository documents</h3>
            <ul className="mt-2 space-y-1 font-mono text-xs text-ink-soft">
              <li>docs/ARCHITECTURE.md</li>
              <li>docs/TRAINING.md</li>
              <li>docs/DATASET.md</li>
              <li>docs/EXPERIMENTS.md</li>
              <li>docs/API.md</li>
              <li>docs/DEPLOYMENT.md</li>
            </ul>
          </div>
          <div className="rounded-lg border border-warn/25 bg-warn-soft p-5 text-xs leading-5 text-warn">
            <strong className="font-semibold text-ink">Scientific Disclaimer:</strong> Decision-support tool; does not replace laboratory physical testing. Cultivar identity for commercial or regulatory purposes must be confirmed by provenance records or laboratory physical fibre testing (HVI/AFIS).
          </div>
        </aside>
      </Container>
    </>
  );
}

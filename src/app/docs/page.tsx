import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/page-header";
import { API_BASE_URL } from "@/lib/config";

export const metadata: Metadata = { title: "Documentation" };

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-ink px-4 py-3 text-xs leading-5 text-white/90">
      <code>{children}</code>
    </pre>
  );
}

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/v1/health", "Liveness, database and model status"],
  ["GET", "/api/v1/models", "Registry contents"],
  ["GET", "/api/v1/models/active", "Model currently served (or mock)"],
  ["GET", "/api/v1/classes", "Classes the active model predicts, with variety info"],
  ["POST", "/api/v1/predict?explain=true&top_k=3", "Classify one image (multipart field `file`)"],
  ["POST", "/api/v1/predict/batch", "Classify several images (multipart field `files`)"],
  ["GET", "/api/v1/predictions", "Paginated, filterable, sortable history"],
  ["GET", "/api/v1/predictions/{id}", "Full prediction record"],
  ["DELETE", "/api/v1/predictions/{id}", "Delete a record and its files"],
  ["GET", "/api/v1/statistics", "Aggregates over stored predictions"],
  ["GET", "/api/v1/system/info", "Runtime information"],
];

export default function DocsPage() {
  return (
    <>
      <PageHeader eyebrow="Docs" title="Help & documentation" description="How to photograph fibre, how to read a result, and how to use the API. The full guides live in the repository's docs/ folder." />
      <Container className="grid gap-12 py-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="text-sm lg:sticky lg:top-20 lg:self-start">
          <ul className="space-y-1.5 text-ink-soft">
            {[
              ["#capture", "Capturing images"],
              ["#reading", "Reading a result"],
              ["#modes", "Demo vs trained mode"],
              ["#api", "API quick reference"],
              ["#training", "Training your model"],
              ["#mobile", "Mobile clients"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          <section id="capture">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Capturing images</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
              <li>Photograph loose raw or ginned lint — not bolls on the plant, not yarn, not fabric.</li>
              <li>Fill the frame with fibre on a plain, matte background; avoid labels, hands and rulers in the crop.</li>
              <li>Use even, diffuse light. Strong colour casts and hard shadows change the very cues the model relies on.</li>
              <li>Keep the camera roughly perpendicular and in focus; the model sees a centre crop resized to its training resolution.</li>
              <li>JPEG, PNG or WEBP up to the configured size limit (default 10 MB). Extensions are not trusted; the file content is inspected.</li>
            </ul>
          </section>

          <section id="reading">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Reading a result</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Predicted variety", "The class with the highest calibrated confidence — unless the sample is rejected as unknown."],
                ["Calibrated confidence", "Temperature-scaled softmax fitted on validation data. The raw softmax value is shown underneath for transparency."],
                ["High / medium / low", "≥ 85% / 65–85% / below 65% but above the unknown threshold."],
                ["Unknown", "Confidence below the configured threshold. No variety is asserted; the closest class is shown for context only."],
                ["Ranked predictions", "Top-k classes with calibrated and raw scores — useful for spotting confusable pairs."],
                ["Heatmap", "Grad-CAM overlay of regions that increased the predicted class score. In demo mode it is a texture map, clearly labelled as such."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-lg border border-line bg-surface p-4">
                  <dt className="text-sm font-semibold text-ink">{t}</dt>
                  <dd className="mt-1 text-sm leading-6 text-ink-soft">{d}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="modes">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Demo vs trained mode</h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              The backend runs with <code className="font-mono text-xs">MODEL_MODE=mock</code> until a model is registered. Mock predictions run the real upload, validation and
              preprocessing path but produce deterministic placeholder scores; every response carries <code className="font-mono text-xs">is_mock: true</code> and the interface shows
              a persistent “Demo Mode” banner. Set <code className="font-mono text-xs">MODEL_MODE=trained</code> after activating a model in <code className="font-mono text-xs">models/registry.json</code>.
            </p>
          </section>

          <section id="api">
            <h2 className="text-lg font-semibold tracking-tight text-ink">API quick reference</h2>
            <p className="mt-2 text-sm text-ink-soft">
              This client talks to <code className="font-mono text-xs">{API_BASE_URL}</code>. Interactive OpenAPI docs are served by the backend at <code className="font-mono text-xs">/docs</code>.
            </p>
            <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <tbody>
                  {ENDPOINTS.map(([m, p, d]) => (
                    <tr key={p + m} className="border-t border-line first:border-t-0">
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-accent">{m}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink">{p}</td>
                      <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Code>{`curl -X POST "http://localhost:8000/api/v1/predict?explain=true&top_k=3" \\
  -F "file=@data/samples/synthetic_sample_03.png"`}</Code>
          </section>

          <section id="training">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Training your model</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Place one folder per variety under <code className="font-mono text-xs">data/raw/</code>, then run the pipeline from the repository root. The complete, step-by-step guide is{" "}
              <code className="font-mono text-xs">docs/TRAINING.md</code>.
            </p>
            <Code>{`python -m ml.audit_dataset
python -m ml.split_dataset --config config/train.yaml
python -m ml.train --config config/train.yaml --architecture convnext_tiny
python -m ml.evaluate --checkpoint models/checkpoints/baseline_convnext_tiny/best.pt
python -m ml.export_model --checkpoint models/checkpoints/baseline_convnext_tiny/best.pt \\
  --name convnext_tiny_v1 --version 1.0.0 --activate
MODEL_MODE=trained uvicorn backend.app.main:app --port 8000`}</Code>
          </section>

          <section id="mobile">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Mobile clients</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              The web app contains no business logic; a React Native or Flutter app uses the same endpoints. Send a multipart request with the image in the{" "}
              <code className="font-mono text-xs">file</code> field and an optional <code className="font-mono text-xs">client_metadata</code> JSON string. Returned image and heatmap URLs are absolute.
            </p>
            <Code>{`const form = new FormData();
form.append("file", { uri, name: "cotton.jpg", type: "image/jpeg" });
form.append("client_metadata", JSON.stringify({ device: "android", app: "1.0.0" }));
const res = await fetch("https://api.example.com/api/v1/predict?explain=true", { method: "POST", body: form });
const result = await res.json(); // result.prediction.display_name, result.prediction.confidence, result.is_mock`}</Code>
          </section>
        </div>
      </Container>
    </>
  );
}

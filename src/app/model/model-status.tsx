"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useActiveModel, useModels, useSystemInfo } from "@/lib/hooks";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

export function ModelStatus() {
  const active = useActiveModel();
  const models = useModels();
  const system = useSystemInfo();

  if (active.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (active.isError || !active.data) return <ErrorState error={active.error} title="Backend unavailable" onRetry={() => active.refetch()} />;
  const a = active.data;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Active model"
          description={a.message}
          action={<Badge tone={a.status === "ready" ? (a.is_mock ? "warn" : "accent") : "danger"}>{a.is_mock ? "Demo mode" : a.status}</Badge>}
        />
        <CardBody>
          <dl className="divide-y divide-line">
            <Row k="Mode" v={a.mode} />
            <Row k="Model" v={<span className="font-mono text-xs">{a.model_name ?? "—"}</span>} />
            <Row k="Version" v={<span className="font-mono text-xs">{a.model_version ?? "—"}</span>} />
            <Row k="Architecture" v={a.architecture ?? "—"} />
            <Row k="Device" v={a.device ?? "—"} />
            <Row k="Input size" v={a.image_size ? `${a.image_size} × ${a.image_size}` : "—"} />
            <Row k="Calibration temperature" v={a.calibration_temperature?.toFixed(3) ?? "—"} />
            <Row k="Unknown strategy" v={a.ood ? `${String(a.ood.name ?? "")}${a.ood.threshold !== undefined ? ` (≥ ${Math.round(Number(a.ood.threshold) * 100)}%)` : ""}` : "—"} />
            <Row k="Parameters" v={a.num_parameters ? `${(a.num_parameters / 1e6).toFixed(1)} M` : "—"} />
          </dl>
          {a.error ? <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{a.error}</p> : null}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Classes ({a.class_names.length})</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {a.class_names.map((c) => (
                <Badge key={c}>{c.replace(/_/g, " ")}</Badge>
              ))}
            </div>
            {a.is_mock ? <p className="mt-2 text-xs text-ink-muted">In demo mode class names come from config/varieties.yaml; a trained model brings its own class list.</p> : null}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Model registry" description={models.data ? models.data.registry_path : undefined} />
          <CardBody>
            {models.isLoading ? (
              <Skeleton className="h-16" />
            ) : models.isError || !models.data ? (
              <p className="text-sm text-ink-muted">Registry unavailable.</p>
            ) : models.data.models.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No models registered yet. After training, run <code className="font-mono text-xs">python -m ml.export_model … --activate</code>.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {models.data.models.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-ink">
                        {m.name} <span className="text-ink-muted">v{m.version}</span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        {m.architecture} · {m.class_names.length} classes{m.size_mb ? ` · ${m.size_mb} MB` : ""}
                        {!m.checkpoint_exists ? " · checkpoint missing" : ""}
                      </p>
                    </div>
                    {m.is_active ? <Badge tone="accent">active</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Runtime" />
          <CardBody>
            {system.data ? (
              <dl className="divide-y divide-line">
                <Row k="API version" v={system.data.version} />
                <Row k="Environment" v={system.data.environment} />
                <Row k="Python" v={system.data.python_version} />
                <Row k="PyTorch" v={system.data.torch_version ?? "not installed (mock mode)"} />
                <Row k="CUDA / MPS" v={`${system.data.cuda_available ? "yes" : "no"} / ${system.data.mps_available ? "yes" : "no"}`} />
                <Row k="Database" v={system.data.database_backend} />
                <Row k="Storage" v={system.data.storage_backend} />
                <Row k="Max upload" v={`${system.data.max_upload_mb} MB`} />
              </dl>
            ) : (
              <Skeleton className="h-24" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

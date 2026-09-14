import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { VarietyInfo } from "@/lib/types";

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

export interface VarietyDetailCardProps {
  variety?: VarietyInfo | null;
  className?: string;
  isUnknown?: boolean;
}

export function VarietyDetailCard({ variety, className, isUnknown = false }: VarietyDetailCardProps) {
  if (isUnknown || !variety) {
    return (
      <Card className={className}>
        <CardHeader title="Variety information" />
        <CardBody>
          <p className="text-sm text-ink-muted">No variety information is shown for unknown / rejected predictions.</p>
        </CardBody>
      </Card>
    );
  }

  if (!variety.has_info) {
    return (
      <Card className={className}>
        <CardHeader title="Variety information" />
        <CardBody>
          <p className="text-sm text-ink-muted">
            No metadata catalog entry found for <span className="font-medium text-ink">{variety.display_name}</span>.
            In Cotton Grade, variety catalog metadata is optional display enrichment; class inventory is strictly derived from the active model.
          </p>
        </CardBody>
      </Card>
    );
  }

  const hasAgronomicData =
    variety.staple_length_mm != null ||
    variety.micronaire != null ||
    variety.strength_g_tex != null ||
    Boolean(variety.staple_category);

  return (
    <Card className={className}>
      <CardHeader
        title="Variety information"
        description={
          variety.demo_placeholder
            ? "Synthetic demonstration metadata — no verified laboratory facts"
            : variety.source
            ? `Source: ${variety.source}`
            : undefined
        }
      />
      <CardBody className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label="Display name" value={variety.display_name} />
          {variety.scientific_name ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Scientific Name</dt>
              <dd className="mt-0.5 text-sm italic text-ink">{variety.scientific_name}</dd>
            </div>
          ) : null}
          {variety.region ? <Stat label="Region" value={variety.region} /> : null}
          {variety.designation ? <Stat label="Designation" value={variety.designation} /> : null}
        </dl>

        {variety.description ? (
          <p className="text-xs leading-5 text-ink-soft">{variety.description}</p>
        ) : null}

        {hasAgronomicData ? (
          <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Agronomic & Fibre Properties
            </h4>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {variety.staple_category ? (
                <div>
                  <dt className="text-ink-muted">Category</dt>
                  <dd className="font-medium text-ink">{variety.staple_category}</dd>
                </div>
              ) : null}
              {variety.staple_length_mm != null ? (
                <div>
                  <dt className="text-ink-muted">Staple Length</dt>
                  <dd className="font-medium text-ink">{variety.staple_length_mm.toFixed(1)} mm</dd>
                </div>
              ) : null}
              {variety.micronaire != null ? (
                <div>
                  <dt className="text-ink-muted">Micronaire</dt>
                  <dd className="font-medium text-ink">{variety.micronaire.toFixed(1)}</dd>
                </div>
              ) : null}
              {variety.strength_g_tex != null ? (
                <div>
                  <dt className="text-ink-muted">Tensile Strength</dt>
                  <dd className="font-medium text-ink">{variety.strength_g_tex.toFixed(1)} g/tex</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {variety.characteristics && variety.characteristics.length > 0 ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Characteristics</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {variety.characteristics.map((c) => (
                <Badge key={c} tone="neutral">
                  {c}
                </Badge>
              ))}
            </dd>
          </div>
        ) : null}

        {variety.source ? (
          <div className="border-t border-line pt-2 text-[11px] text-ink-muted">
            <span className="font-medium">Provenance:</span> {variety.source}
          </div>
        ) : null}

        {variety.notes ? (
          <p className="text-xs leading-5 text-ink-muted">{variety.notes}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

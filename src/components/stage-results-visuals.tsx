"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const histories = {
  leaf: [0.8437,0.9478,0.9002,0.9119,0.9692,0.9541,0.9779,0.9766,0.9778,0.9520,0.9780,0.9898,0.9882,0.9941,0.9897,0.9839,0.9885,0.9885,0.9941,0.9941],
  seed: [0.6545,0.8962,0.9102,0.9106,0.9254,0.9100,0.9256,0.9404,0.9552,0.9404,0.9404,0.9545,0.9404,0.9404,0.9404,0.9545,0.9545],
} as const;

const matrices = {
  leaf: {
    labels: ["Alternaria", "Bacterial", "Fusarium", "Healthy", "Verticillium"],
    values: [[24,0,0,0,0],[0,26,0,0,2],[0,0,48,0,0],[0,0,0,26,0],[0,0,0,0,43]],
  },
  seed: {
    labels: ["Broken", "Cracked", "Intact"],
    values: [[21,0,1],[0,23,0],[0,2,21]],
  },
} as const;

export function StageResultsVisuals({ stageId }: { stageId: "leaf" | "seed" }) {
  const history = histories[stageId].map((macroF1, index) => ({ epoch: index + 1, macroF1: macroF1 * 100 }));
  const matrix = matrices[stageId];
  const max = Math.max(...matrix.values.flat());

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <article className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Validation history</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">Macro-F1 across epochs</h3>
        <div className="mt-6 h-72" role="img" aria-label="Validation macro-F1 training curve">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 12, left: -4, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
              <YAxis domain={stageId === "leaf" ? [80, 100] : [60, 100]} tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} width={38} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, "Macro-F1"]} labelFormatter={(label) => `Epoch ${label}`} />
              <Line
                type="monotone"
                dataKey="macroF1"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Held-out test set</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">Confusion matrix</h3>
        <div className="mt-6 max-w-full overflow-x-auto">
          <div className="min-w-[300px]">
            <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${matrix.labels.length}, minmax(36px, 1fr))` }}>
              <div />
              {matrix.labels.map((label) => <div key={label} className="px-0.5 pb-2 text-center text-[9px] font-semibold text-ink-muted sm:text-[10px]">{label}</div>)}
              {matrix.values.map((row, rowIndex) => (
                <div key={matrix.labels[rowIndex]} className="contents">
                  <div className="flex items-center pr-2 text-[10px] font-semibold text-ink-soft sm:text-xs">{matrix.labels[rowIndex]}</div>
                  {row.map((value, colIndex) => {
                    const strength = max ? value / max : 0;
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className="grid aspect-square min-h-10 place-items-center rounded-lg border border-line text-xs font-semibold text-ink sm:text-sm"
                        style={{ background: `color-mix(in srgb, var(--color-accent) ${Math.round(8 + strength * 48)}%, white)` }}
                        title={`Actual ${matrix.labels[rowIndex]}, predicted ${matrix.labels[colIndex]}: ${value}`}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-ink-muted">Rows = actual class · columns = predicted class</p>
          </div>
        </div>
      </article>
    </div>
  );
}

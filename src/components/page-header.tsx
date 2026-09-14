import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-14 sm:px-6 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-4xl">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
          <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[0.98] text-ink sm:text-6xl">{title}</h1>
          {description ? <p className="mt-5 max-w-3xl text-base leading-7 text-ink-soft sm:text-lg sm:leading-8">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

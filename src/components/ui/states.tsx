import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, toApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center", className)}>
      <div className="mb-3 rounded-full bg-surface-muted p-3 text-ink-muted">{icon ?? <Inbox className="h-5 w-5" aria-hidden />}</div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, title = "Something went wrong", onRetry, className }: { error: unknown; title?: string; onRetry?: () => void; className?: string }) {
  const apiError: ApiError = toApiError(error);
  return (
    <div role="alert" className={cn("rounded-lg border border-danger/25 bg-danger-soft/60 px-5 py-5", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-danger">{title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{apiError.userMessage}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            code: {apiError.code}
            {apiError.status ? ` · status ${apiError.status}` : ""}
            {apiError.requestId ? ` · request ${apiError.requestId}` : ""}
          </p>
          {onRetry ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

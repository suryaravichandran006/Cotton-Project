import type { HTMLAttributes } from "react";
import { cn, toneClasses } from "@/lib/utils";

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof toneClasses }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)} {...props} />;
}

import { cn } from "@/lib/utils";

export function VerticalConnector({ dashed = false, animated = false, className }: { dashed?: boolean; animated?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("relative mx-auto h-14 w-8", className)}>
      <span className={cn("absolute left-1/2 top-0 h-[calc(100%-10px)] -translate-x-1/2 border-l-2 border-[#202923]", dashed && "border-dashed border-[#68736b]")} />
      <span className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-[#202923]", dashed && "border-t-[#68736b]")} />
      {animated ? <span data-transfer-token className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#245b47] bg-[#f7fbf8] opacity-0 shadow-[0_0_0_4px_rgba(36,91,71,0.12)]" /> : null}
    </div>
  );
}

export function HorizontalConnector({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative hidden h-8 items-center lg:flex", className)}>
      <span className="h-0.5 w-full bg-[#202923]" />
      <span className="absolute right-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-[#202923]" />
    </div>
  );
}

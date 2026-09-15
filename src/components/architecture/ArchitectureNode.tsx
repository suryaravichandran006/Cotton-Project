import { cn } from "@/lib/utils";

export type ArchitectureNodeTone = "dataset" | "process" | "model" | "output" | "service";

const toneClasses: Record<ArchitectureNodeTone, string> = {
  dataset: "border-[#493139] bg-[#f8dfe5]",
  process: "border-[#4a4023] bg-[#f8edbd]",
  model: "border-[#263d49] bg-[#d9edf7]",
  output: "border-[#294435] bg-[#dcefdc]",
  service: "border-[#3d3454] bg-[#e8e0f5]",
};

export function ArchitectureNode({
  title,
  detail,
  tone,
  className,
}: {
  title: string;
  detail?: string;
  tone: ArchitectureNodeTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border-2 px-4 py-4 text-center shadow-[0_4px_0_rgba(28,37,32,0.07)]",
        toneClasses[tone],
        className,
      )}
    >
      <p className="text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-[#18211c] sm:text-lg">
        {title}
      </p>
      {detail ? <p className="mt-1 text-sm font-medium leading-5 text-[#334139] sm:text-[15px]">{detail}</p> : null}
    </div>
  );
}

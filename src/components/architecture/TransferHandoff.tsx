import { VerticalConnector } from "@/components/architecture/connectors";

export function TransferHandoff({
  status,
  tensors,
  replaced,
}: {
  status: "verified" | "planned";
  tensors?: number;
  replaced?: number;
}) {
  const verified = status === "verified";

  return (
    <section
      data-transfer={verified ? "complete" : "planned"}
      aria-label={verified ? "Verified leaf to seed transfer" : "Planned seed to final transfer"}
      className="grid items-center gap-3 py-2 lg:grid-cols-[1fr_280px_1fr]"
    >
      <div className="hidden lg:block" />
      <div className="flex flex-col items-center">
        <VerticalConnector animated={verified} dashed={!verified} className="h-10" />
        <div className={verified ? "w-full rounded-xl border-2 border-[#4a4023] bg-[#f8edbd] px-5 py-4 text-center shadow-[0_4px_0_rgba(28,37,32,0.07)]" : "w-full rounded-xl border-2 border-dashed border-[#6c654d] bg-[#fbf5d9] px-5 py-4 text-center"}>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-lg font-extrabold leading-tight text-[#1d251f]">Transfer Learning</h2>
            {!verified ? <span className="rounded-full border border-[#786b3d] px-2 py-0.5 text-xs font-bold text-[#645728]">Planned</span> : null}
          </div>
          <p className="mt-1 text-sm font-medium leading-5 text-[#394139]">Keep backbone<br />Replace task head</p>
        </div>
        <VerticalConnector dashed={!verified} className="h-10" />
      </div>

      {verified && (tensors !== undefined || replaced !== undefined) ? (
        <aside className="rounded-lg border-2 border-dashed border-[#667068] bg-[#fffefa] px-4 py-3 text-sm font-medium leading-6 text-[#344038] lg:justify-self-start">
          {tensors !== undefined ? <p><strong className="font-extrabold text-[#172019]">{tensors}</strong> compatible tensors transferred</p> : null}
          {replaced !== undefined ? <p><strong className="font-extrabold text-[#172019]">{replaced}</strong> head tensors replaced</p> : null}
        </aside>
      ) : (
        <p className="text-center text-sm font-semibold text-[#6f673f] lg:text-left">Final dataset access and training pending</p>
      )}
    </section>
  );
}

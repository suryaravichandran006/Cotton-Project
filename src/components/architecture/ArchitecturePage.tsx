import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { getArchitectureViewModel } from "@/components/architecture/architecture-data";
import { PageHeader } from "@/components/page-header";

export function ArchitecturePage() {
  const data = getArchitectureViewModel();

  return (
    <>
      <PageHeader
        eyebrow="Model Architecture"
        title="One visual backbone, progressively adapted to cotton."
        description="ImageNet initializes ConvNeXt-Tiny. Cotton leaf and seed tasks progressively adapt its learned features before the final controlled cultivar experiment."
      />

      <div className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <ArchitectureDiagram data={data} />
      </div>
    </>
  );
}

import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { getArchitectureViewModel } from "@/components/architecture/architecture-data";
import { Container } from "@/components/page-header";

export function ArchitecturePage() {
  const data = getArchitectureViewModel();

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-16 text-center sm:py-20 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold text-accent">Model Architecture</p>
            <h1 className="font-display mx-auto mt-4 max-w-5xl text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              How the model learns across each stage.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink-soft">
              ImageNet initializes ConvNeXt-Tiny. Cotton leaf and seed tasks progressively adapt its learned features before the final controlled cultivar experiment.
            </p>
          </div>
        </Container>
      </section>

      <div className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <ArchitectureDiagram data={data} />
      </div>
    </>
  );
}

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/page-header";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="font-mono text-xs text-ink-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">This page does not exist</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">The link may be outdated or the record may have been deleted.</p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/analyze" variant="secondary">
          Analyze cotton
        </ButtonLink>
      </div>
    </Container>
  );
}

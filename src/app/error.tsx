"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/page-header";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 text-center">
      <p className="font-mono text-xs text-ink-muted">Unexpected error</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">The page failed to render</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{error.message || "An unknown error occurred."}</p>
      {error.digest ? <p className="mt-1 font-mono text-xs text-ink-muted">digest {error.digest}</p> : null}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </Container>
  );
}

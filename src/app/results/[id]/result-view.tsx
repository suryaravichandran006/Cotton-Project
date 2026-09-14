"use client";

import { PredictionResult } from "@/components/prediction-result";
import { Container, PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api";
import { usePrediction } from "@/lib/hooks";

export function ResultView({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = usePrediction(id);

  return (
    <>
      <PageHeader
        eyebrow="Result"
        title={data ? (data.prediction.is_unknown ? "Unknown sample" : data.prediction.display_name) : "Prediction result"}
        description={data ? `Prediction ${data.id}` : undefined}
        actions={
          <ButtonLink href="/analyze" variant="secondary" size="sm">
            New analysis
          </ButtonLink>
        }
      />
      <Container className="py-8">
        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2" aria-busy>
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : isError ? (
          error instanceof ApiError && error.status === 404 ? (
            <EmptyState title="Prediction not found" description="It may have been deleted from the history." action={<ButtonLink href="/history" variant="secondary" size="sm">Back to history</ButtonLink>} />
          ) : (
            <ErrorState error={error} title="Could not load this result" onRetry={() => refetch()} />
          )
        ) : data ? (
          <PredictionResult result={data} />
        ) : null}
      </Container>
    </>
  );
}

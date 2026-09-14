"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PredictionListParams, PredictionResponse } from "@/lib/types";

export const queryKeys = {
  activeModel: ["model", "active"] as const,
  models: ["models"] as const,
  classes: ["classes"] as const,
  systemInfo: ["system", "info"] as const,
  statistics: ["statistics"] as const,
  predictions: (params: PredictionListParams) => ["predictions", params] as const,
  prediction: (id: string) => ["prediction", id] as const,
};

export function useActiveModel() {
  return useQuery({ queryKey: queryKeys.activeModel, queryFn: api.activeModel, staleTime: 30_000 });
}

export function useModels() {
  return useQuery({ queryKey: queryKeys.models, queryFn: api.models, staleTime: 30_000 });
}

export function useClasses() {
  return useQuery({ queryKey: queryKeys.classes, queryFn: api.classes, staleTime: 60_000 });
}

export function useSystemInfo() {
  return useQuery({ queryKey: queryKeys.systemInfo, queryFn: api.systemInfo, staleTime: 30_000 });
}

export function useStatistics() {
  return useQuery({ queryKey: queryKeys.statistics, queryFn: api.statistics, staleTime: 10_000 });
}

export function usePredictions(params: PredictionListParams) {
  return useQuery({ queryKey: queryKeys.predictions(params), queryFn: () => api.predictions(params), placeholderData: keepPreviousData, staleTime: 5_000 });
}

export function usePrediction(id: string) {
  return useQuery({ queryKey: queryKeys.prediction(id), queryFn: () => api.prediction(id), enabled: Boolean(id), retry: (count, err) => !(err instanceof Error && "status" in err && (err as { status: number | null }).status === 404) && count < 2 });
}

export function usePredictMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, explain, topK }: { file: File; explain: boolean; topK: number }) => api.predict(file, { explain, topK }),
    onSuccess: (data: PredictionResponse) => {
      qc.setQueryData(queryKeys.prediction(data.id), data);
      void qc.invalidateQueries({ queryKey: ["predictions"] });
      void qc.invalidateQueries({ queryKey: queryKeys.statistics });
    },
  });
}

export function useDeletePrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePrediction(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: queryKeys.prediction(id) });
      void qc.invalidateQueries({ queryKey: ["predictions"] });
      void qc.invalidateQueries({ queryKey: queryKeys.statistics });
    },
  });
}

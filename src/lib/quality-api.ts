import { request } from "@/lib/api";
import { API_V1 } from "@/lib/config";
import { labReferencesSchema, qualityHistorySchema, qualityResponseSchema, qualityStatusSchema } from "@/lib/quality-types";
import { z } from "zod";

export const qualityApi = {
  status: () => request("/quality/status", qualityStatusSchema),
  references: () => request("/quality/references", labReferencesSchema),
  analyze: (file: File) => {
    const form = new FormData(); form.append("file", file, file.name);
    return request("/quality/analyze", qualityResponseSchema, { method: "POST", body: form });
  },
  analysis: (id: string) => request(`/quality/analyses/${encodeURIComponent(id)}`, qualityResponseSchema),
  history: (page = 1) => request(`/quality/analyses?page=${page}&page_size=20`, qualityHistorySchema),
  delete: (id: string) => request(`/quality/analyses/${encodeURIComponent(id)}`, z.object({ id: z.string(), deleted: z.boolean() }), { method: "DELETE" }),
  csvUrl: (id: string) => `${API_V1}/quality/analyses/${encodeURIComponent(id)}/csv`,
  referenceCsvUrl: (id: string) => `${API_V1}/quality/analyses/${encodeURIComponent(id)}/reference.csv`,
  reportUrl: `${API_V1}/quality/report`,
};
export const qualityModelName = (name: string) => ({ mean: "Mean baseline", ridge: "CNN features + ridge", cnn: "CNN regression", cnn_lstm: "CNN + LSTM" })[name] ?? name;

/**
 * Frontend configuration.
 *
 * NEXT_PUBLIC_API_URL — origin of the FastAPI backend (e.g. http://localhost:8000).
 * When unset, requests go through the same-origin proxy at /api/backend, which
 * forwards to BACKEND_INTERNAL_URL (server-side only). Both routes hit the same
 * REST contract, so mobile clients can call the backend origin directly.
 */
const rawBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (rawBase && rawBase.length > 0 ? rawBase : "/api/backend").replace(/\/+$/, "");
export const API_V1 = `${API_BASE_URL}/api/v1`;
export const USING_PROXY = !rawBase;

export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 10);
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const REQUEST_TIMEOUT_MS = 90_000;

export const SITE = {
  name: "Cotton Grade",
  tagline: "Cotton variety identification from raw fibre images",
  repoDocs: "docs/",
} as const;

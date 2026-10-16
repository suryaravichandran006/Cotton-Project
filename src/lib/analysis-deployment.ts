/** Server-side deployment mode. Set at build AND runtime for the hosted single page. */
export function isAnalysisOnly() {
  return process.env.ANALYSIS_ONLY === "true";
}

/** Explicit public surface: a single page, its saved-result links and supporting APIs. */
export function isAnalysisRequestAllowed(path: string, method: string) {
  const read = method === "GET" || method === "HEAD";
  if (read && (path === "/" || path.startsWith("/_next/static/") || path === "/favicon.ico")) return true;
  if (read && /^\/api\/backend\/api\/v1\/quality\/(status|references|report)$/.test(path)) return true;
  if (method === "POST" && path === "/api/backend/api/v1/quality/analyze") return true;
  if (read && /^\/api\/backend\/api\/v1\/quality\/analyses\/[a-f0-9]{32}(\/(reference\.csv|csv))?$/.test(path)) return true;
  if (read && /^\/api\/backend\/files\/uploads\/[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(path)) return true;
  return false;
}

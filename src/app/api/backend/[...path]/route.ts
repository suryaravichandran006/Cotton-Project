/**
 * Same-origin reverse proxy to the FastAPI backend.
 *
 * Browser -> /api/backend/<path> -> BACKEND_INTERNAL_URL/<path>
 *
 * Transparent pass-through (no business logic) so the web app works without
 * CORS configuration and the backend can stay private in deployments.
 * Mobile clients call the backend origin directly.
 */
import type { NextRequest } from "next/server";
import { isAnalysisOnly, isAnalysisRequestAllowed } from "@/lib/analysis-deployment";

export const dynamic = "force-dynamic";

const BACKEND = (process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const PREFIX = "/api/backend";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  if (isAnalysisOnly() && !isAnalysisRequestAllowed(req.nextUrl.pathname, req.method)) {
    return Response.json({ error: { code: "not_found", message: "Page not found" } }, { status: 404 });
  }
  const { path } = await ctx.params;
  const target = `${BACKEND}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("x-forwarded-host", req.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));
  headers.set("x-forwarded-prefix", PREFIX);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      redirect: "manual",
      cache: "no-store",
    };
    if (hasBody) init.duplex = "half";
    const upstream = await fetch(target, init);
    const out = new Headers(upstream.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    out.delete("transfer-encoding");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  } catch {
    return Response.json(
      { error: { code: "backend_unreachable", message: `The Cotton Grade backend at ${BACKEND} is not reachable. Start it with \`make backend\`.`, details: null }, request_id: null },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as DELETE, proxy as OPTIONS, proxy as HEAD };

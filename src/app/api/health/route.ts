/**
 * Web-app health endpoint (used by the hosting platform / load balancers).
 *
 * The ML/API health lives in the FastAPI backend at /api/v1/health. This route
 * only reports that the Next.js server is up and, when DATABASE_URL is set for
 * the platform's Drizzle connection, that the database is reachable.
 */
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: { web: "ok"; database: "ok" | "error" | "skipped"; backend_proxy: string } = {
    web: "ok",
    database: "skipped",
    backend_proxy: process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
  };
  if (process.env.DATABASE_URL) {
    try {
      const { db } = await import("@/db");
      await db.execute(sql`select 1`);
      checks.database = "ok";
    } catch {
      checks.database = "error";
      return Response.json({ ok: false, ...checks }, { status: 500 });
    }
  }
  return Response.json({ ok: true, ...checks });
}

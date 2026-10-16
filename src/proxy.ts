import { NextResponse, type NextRequest } from "next/server";
import { isAnalysisOnly, isAnalysisRequestAllowed } from "@/lib/analysis-deployment";

export function proxy(request: NextRequest) {
  if (!isAnalysisOnly()) return NextResponse.next();
  if (["GET", "HEAD"].includes(request.method) && request.nextUrl.pathname === "/analyze") {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    return NextResponse.redirect(target, 308);
  }
  if (!isAnalysisRequestAllowed(request.nextUrl.pathname, request.method)) {
    return new NextResponse("Page not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

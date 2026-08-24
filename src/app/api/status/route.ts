import { NextResponse } from "next/server";
import { runAllProbes } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated uptime report for all safe API probes.
 * Does not scrape jobs or call Gemini.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const started = Date.now();
  const { overall, checks } = await runAllProbes(origin);

  return NextResponse.json({
    ok: overall !== "down",
    overall,
    service: "jobhunter-web",
    product: "JobHunter",
    brand: "Alfredterminal",
    checked_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    checks,
    note: "Safe readiness probes only. Hunt/analyze/polish POST bodies are not executed here.",
  });
}

import { NextResponse } from "next/server";
import { listSourceInventory } from "@/lib/sources";

export async function GET() {
  const inventory = listSourceInventory();
  const keyed = inventory.filter((s) => s.mode === "keyed");
  return NextResponse.json({
    ok: true,
    service: "jobhunter-web",
    product: "JobHunter",
    brand: "Alfredterminal",
    operable: true,
    endpoints: [
      "/api/health",
      "/api/status",
      "/api/regions",
      "/api/analyze",
      "/api/hunt",
      "/api/polish",
      "/api/deep-hunt",
    ],
    status_page: "/status",
    features: {
      role_families: true,
      apply_tracker: true,
      date_windows: true,
      ai_polish_opt_in: true,
      deep_hunt_optional: true,
      auto_apply: false,
      linkedin_scrape: false,
    },
    job_sources: {
      inventory,
      always_on: inventory.filter((s) => s.mode === "always").map((s) => s.id),
      region_gated: inventory.filter((s) => s.mode === "region").map((s) => s.id),
      keyed: keyed.map((s) => ({
        id: s.id,
        needs: s.needsEnv || [],
      })),
      note: "LinkedIn is never scraped (ToS). Per-hunt portal ok/fail/counts are in POST /api/hunt sources[].",
    },
    note: "Browser hunt uses public job APIs + TypeScript eligibility. AI polish optional via GEMINI_API_KEY. Python deep hunt via DEEP_HUNT_URL.",
  });
}

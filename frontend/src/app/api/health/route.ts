import { NextResponse } from "next/server";

export async function GET() {
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
    },
    note: "Browser hunt uses public job APIs + TypeScript eligibility. AI polish optional via GEMINI_API_KEY. Python deep hunt via DEEP_HUNT_URL.",
  });
}

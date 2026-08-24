import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "jobhunter-web",
    product: "JobHunter",
    brand: "Alfredterminal",
    note: "Frontend health check. Python CLI remains the hunting engine.",
  });
}

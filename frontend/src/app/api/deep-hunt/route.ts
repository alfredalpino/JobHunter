import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional proxy to local Python deep hunt (JobSpy / HTML).
 * Set DEEP_HUNT_URL=http://127.0.0.1:8765 — off by default for Vercel friends.
 */
export async function POST(request: Request) {
  const base = process.env.DEEP_HUNT_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Deep hunt not configured. Run scripts/deep_hunt_server.py locally and set DEEP_HUNT_URL.",
      },
      { status: 501 },
    );
  }

  try {
    const body = await request.json();
    const res = await fetch(`${base}/deep-hunt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Deep hunt proxy failed",
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  const base = process.env.DEEP_HUNT_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      note: "Set DEEP_HUNT_URL to enable Python deep hunt.",
    });
  }
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ ok: true, enabled: true, upstream: data });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      enabled: true,
      error: err instanceof Error ? err.message : "upstream down",
    });
  }
}

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/ingest/auth";
import { runIngest } from "@/lib/ingest/runIngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual ingest trigger — same secret as cron. */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      fresh?: boolean;
      maxSeeds?: number;
    };
    const result = await runIngest({
      fresh: body.fresh === true,
      maxSeeds: typeof body.maxSeeds === "number" ? body.maxSeeds : 12,
    });
    if (result.skipped) {
      return NextResponse.json(
        { ok: false, skipped: true, error: result.reason },
        { status: 503 },
      );
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Ingest failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    ready: true,
    method: "POST",
    note: "POST with Authorization: Bearer $CRON_SECRET to run ingest.",
  });
}

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/ingest/auth";
import { runIngest } from "@/lib/ingest/runIngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleIngest(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    let fresh = false;
    let maxSeeds: number | undefined;
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        fresh?: boolean;
        maxSeeds?: number;
      };
      fresh = body.fresh === true;
      maxSeeds =
        typeof body.maxSeeds === "number" ? body.maxSeeds : undefined;
    }
    const result = await runIngest({ fresh, maxSeeds });
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

/** Vercel cron invokes GET; manual clients may POST. */
export async function GET(request: Request) {
  return handleIngest(request);
}

export async function POST(request: Request) {
  return handleIngest(request);
}

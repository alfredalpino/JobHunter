import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkHuntRateLimit,
  checkPolishRateLimit,
  clientIpFromHeaders,
} from "@/lib/rate-limit";

export function middleware(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);

  if (
    request.method === "POST" &&
    request.nextUrl.pathname === "/api/hunt"
  ) {
    const { allowed, retryAfterSec } = checkHuntRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many hunts from this network. Try again in ${retryAfterSec ?? 60} seconds.`,
        },
        {
          status: 429,
          headers: retryAfterSec
            ? { "Retry-After": String(retryAfterSec) }
            : undefined,
        },
      );
    }
  }

  if (
    request.method === "POST" &&
    request.nextUrl.pathname === "/api/polish"
  ) {
    const { allowed, retryAfterSec } = checkPolishRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many AI polish requests. Try again in ${retryAfterSec ?? 60} seconds.`,
        },
        {
          status: 429,
          headers: retryAfterSec
            ? { "Retry-After": String(retryAfterSec) }
            : undefined,
        },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/hunt", "/api/polish"],
};

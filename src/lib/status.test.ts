import { describe, expect, it, vi } from "vitest";
import {
  API_PROBES,
  interpretProbeResponse,
  runAllProbes,
  summarizeOverall,
  type ProbeResult,
} from "./status";

function result(
  over: Partial<ProbeResult> & Pick<ProbeResult, "id" | "severity" | "state" | "ok">,
): ProbeResult {
  return {
    name: over.id,
    path: `/api/${over.id}`,
    method: "GET",
    description: "",
    statusCode: 200,
    latencyMs: 10,
    detail: "",
    checkedAt: new Date().toISOString(),
    ...over,
  };
}

describe("summarizeOverall", () => {
  it("is operational when critical checks are up", () => {
    expect(
      summarizeOverall([
        result({ id: "health", severity: "critical", state: "up", ok: true }),
        result({
          id: "polish",
          severity: "optional",
          state: "skipped",
          ok: true,
        }),
      ]),
    ).toBe("operational");
  });

  it("is down when a critical check fails", () => {
    expect(
      summarizeOverall([
        result({ id: "health", severity: "critical", state: "down", ok: false }),
        result({ id: "regions", severity: "critical", state: "up", ok: true }),
      ]),
    ).toBe("down");
  });

  it("is degraded when optional upstream fails", () => {
    expect(
      summarizeOverall([
        result({ id: "health", severity: "critical", state: "up", ok: true }),
        result({
          id: "deep-hunt",
          severity: "optional",
          state: "degraded",
          ok: false,
        }),
      ]),
    ).toBe("degraded");
  });
});

describe("interpretProbeResponse", () => {
  const health = API_PROBES.find((p) => p.id === "health")!;
  const regions = API_PROBES.find((p) => p.id === "regions")!;
  const polish = API_PROBES.find((p) => p.id === "polish")!;
  const deep = API_PROBES.find((p) => p.id === "deep-hunt")!;

  it("marks health up on 200", () => {
    expect(interpretProbeResponse(health, 200, { ok: true }, 12)).toEqual({
      state: "up",
      ok: true,
      detail: "12ms",
    });
  });

  it("requires non-empty regions", () => {
    expect(
      interpretProbeResponse(regions, 200, { regions: [], source: "x" }, 5),
    ).toMatchObject({ state: "down", ok: false });
    expect(
      interpretProbeResponse(
        regions,
        200,
        { regions: [{ id: "dubai" }], source: "yaml" },
        8,
      ),
    ).toMatchObject({ state: "up", ok: true });
  });

  it("skips polish when not configured", () => {
    expect(
      interpretProbeResponse(polish, 200, { ok: true, configured: false }, 3),
    ).toMatchObject({ state: "skipped", ok: true });
  });

  it("degrades deep-hunt when enabled but unhealthy", () => {
    expect(
      interpretProbeResponse(
        deep,
        200,
        { ok: false, enabled: true, error: "upstream down" },
        40,
      ),
    ).toMatchObject({ state: "degraded", ok: false });
  });
});

describe("runAllProbes", () => {
  it("runs every registered probe via fetch", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/api/regions") {
        return new Response(
          JSON.stringify({
            regions: [{ id: "dubai", label: "Dubai" }],
            source: "test",
          }),
          { status: 200 },
        );
      }
      if (path === "/api/polish") {
        return new Response(JSON.stringify({ ok: true, configured: false }), {
          status: 200,
        });
      }
      if (path === "/api/deep-hunt") {
        return new Response(JSON.stringify({ ok: true, enabled: false }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const report = await runAllProbes("http://localhost:3000", fetchImpl);
    expect(report.checks).toHaveLength(API_PROBES.length);
    expect(report.overall).toBe("operational");
    expect(fetchImpl).toHaveBeenCalledTimes(API_PROBES.length);
  });
});

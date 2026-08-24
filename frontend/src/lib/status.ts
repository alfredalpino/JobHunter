/** Safe API probes for the status page — no scrapes, no Gemini, no PDF work. */

export type CheckSeverity = "critical" | "optional";
export type CheckState = "up" | "down" | "degraded" | "skipped";
export type OverallStatus = "operational" | "degraded" | "down";

export type ProbeDef = {
  id: string;
  name: string;
  path: string;
  method: "GET";
  severity: CheckSeverity;
  description: string;
};

export type ProbeResult = {
  id: string;
  name: string;
  path: string;
  method: "GET";
  severity: CheckSeverity;
  description: string;
  state: CheckState;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  detail: string;
  checkedAt: string;
};

export const API_PROBES: ProbeDef[] = [
  {
    id: "health",
    name: "Service health",
    path: "/api/health",
    method: "GET",
    severity: "critical",
    description: "Core liveness and feature catalog",
  },
  {
    id: "regions",
    name: "Region packs",
    path: "/api/regions",
    method: "GET",
    severity: "critical",
    description: "Region config load (YAML or fallback)",
  },
  {
    id: "analyze",
    name: "Analyze API",
    path: "/api/analyze",
    method: "GET",
    severity: "critical",
    description: "Resume analysis route readiness (POST does the work)",
  },
  {
    id: "hunt",
    name: "Hunt API",
    path: "/api/hunt",
    method: "GET",
    severity: "critical",
    description: "Job hunt route readiness (POST scrapes)",
  },
  {
    id: "polish",
    name: "AI polish",
    path: "/api/polish",
    method: "GET",
    severity: "optional",
    description: "Optional Gemini polish — needs GEMINI_API_KEY",
  },
  {
    id: "deep-hunt",
    name: "Deep hunt",
    path: "/api/deep-hunt",
    method: "GET",
    severity: "optional",
    description: "Optional Python sidecar — needs DEEP_HUNT_URL",
  },
];

export function summarizeOverall(results: ProbeResult[]): OverallStatus {
  const critical = results.filter((r) => r.severity === "critical");
  if (critical.some((r) => !r.ok || r.state === "down")) return "down";
  if (
    results.some(
      (r) => r.state === "degraded" || (r.severity === "optional" && r.state === "down"),
    )
  ) {
    return "degraded";
  }
  return "operational";
}

export function interpretProbeResponse(
  def: ProbeDef,
  statusCode: number,
  body: unknown,
  latencyMs: number,
): Pick<ProbeResult, "state" | "ok" | "detail"> {
  if (statusCode >= 500) {
    return {
      state: "down",
      ok: false,
      detail: `HTTP ${statusCode}`,
    };
  }
  if (statusCode >= 400) {
    return {
      state: "down",
      ok: false,
      detail: `HTTP ${statusCode}`,
    };
  }

  const data = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;

  if (def.id === "regions") {
    const regions = Array.isArray(data.regions) ? data.regions : [];
    if (!regions.length) {
      return { state: "down", ok: false, detail: "No regions returned" };
    }
    const source = typeof data.source === "string" ? data.source : "unknown";
    return {
      state: "up",
      ok: true,
      detail: `${regions.length} regions · ${source} · ${latencyMs}ms`,
    };
  }

  if (def.id === "polish") {
    const configured = Boolean(data.configured);
    if (!configured) {
      return {
        state: "skipped",
        ok: true,
        detail: "Optional — GEMINI_API_KEY not set",
      };
    }
    if (data.ok === false) {
      return { state: "degraded", ok: false, detail: "Configured but not ready" };
    }
    return {
      state: "up",
      ok: true,
      detail: `Configured · ${latencyMs}ms`,
    };
  }

  if (def.id === "deep-hunt") {
    const enabled = Boolean(data.enabled);
    if (!enabled) {
      return {
        state: "skipped",
        ok: true,
        detail: "Optional — DEEP_HUNT_URL not set",
      };
    }
    if (data.ok === false) {
      return {
        state: "degraded",
        ok: false,
        detail:
          typeof data.error === "string"
            ? data.error
            : "Upstream deep-hunt unhealthy",
      };
    }
    return {
      state: "up",
      ok: true,
      detail: `Enabled · upstream ok · ${latencyMs}ms`,
    };
  }

  if (data.ok === false) {
    return {
      state: "down",
      ok: false,
      detail: typeof data.error === "string" ? data.error : "ok:false",
    };
  }

  return {
    state: "up",
    ok: true,
    detail: `${latencyMs}ms`,
  };
}

export async function runProbe(
  origin: string,
  def: ProbeDef,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  const url = `${origin.replace(/\/$/, "")}${def.path}`;
  const started = Date.now();
  try {
    const res = await fetchImpl(url, {
      method: def.method,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const latencyMs = Date.now() - started;
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const interpreted = interpretProbeResponse(def, res.status, body, latencyMs);
    return {
      id: def.id,
      name: def.name,
      path: def.path,
      method: def.method,
      severity: def.severity,
      description: def.description,
      statusCode: res.status,
      latencyMs,
      checkedAt,
      ...interpreted,
    };
  } catch (err) {
    return {
      id: def.id,
      name: def.name,
      path: def.path,
      method: def.method,
      severity: def.severity,
      description: def.description,
      state: "down",
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : "fetch failed",
      checkedAt,
    };
  }
}

export async function runAllProbes(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ overall: OverallStatus; checks: ProbeResult[] }> {
  const checks = await Promise.all(
    API_PROBES.map((def) => runProbe(origin, def, fetchImpl)),
  );
  return { overall: summarizeOverall(checks), checks };
}

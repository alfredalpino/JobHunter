"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { CheckState, OverallStatus, ProbeResult } from "@/lib/status";

type StatusPayload = {
  ok: boolean;
  overall: OverallStatus;
  checked_at: string;
  duration_ms: number;
  checks: ProbeResult[];
  note?: string;
};

const REFRESH_MS = 30_000;

function stateLabel(state: CheckState): string {
  switch (state) {
    case "up":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    case "skipped":
      return "Not configured";
    default:
      return state;
  }
}

function overallCopy(overall: OverallStatus): { title: string; blurb: string } {
  if (overall === "operational") {
    return {
      title: "All systems operational",
      blurb: "Core JobHunter APIs are responding. Optional services may be off.",
    };
  }
  if (overall === "degraded") {
    return {
      title: "Partial degradation",
      blurb: "Core routes are up; an optional dependency needs attention.",
    };
  }
  return {
    title: "Service disruption",
    blurb: "One or more critical APIs failed readiness checks.",
  };
}

function stateColor(state: CheckState): string {
  if (state === "up") return "var(--seafoam)";
  if (state === "degraded") return "var(--copper)";
  if (state === "skipped") return "var(--sand-muted)";
  return "#e07070";
}

export function StatusBoard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastClientMs, setLastClientMs] = useState<number | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const started = Date.now();
      try {
        const res = await fetch("/api/status", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const json = (await res.json()) as StatusPayload;
        if (!res.ok && !json.checks) {
          throw new Error(`Status HTTP ${res.status}`);
        }
        setData(json);
        setError(null);
        setLastClientMs(Date.now() - started);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status check failed");
      }
    });
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const overall = data?.overall ?? "down";
  const copy = overallCopy(data ? overall : "down");

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-10">
      <div className="rise mb-10">
        <p className="text-xs tracking-[0.14em] text-seafoam uppercase">
          System status
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl tracking-tight text-sand md:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-xl text-sand-muted">{copy.blurb}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-sand-muted">
          <span
            className="inline-flex items-center gap-2"
            style={{ color: stateColor(overall === "down" ? "down" : overall === "degraded" ? "degraded" : "up") }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: stateColor(
                  overall === "down"
                    ? "down"
                    : overall === "degraded"
                      ? "degraded"
                      : "up",
                ),
                boxShadow: `0 0 12px ${stateColor(
                  overall === "down"
                    ? "down"
                    : overall === "degraded"
                      ? "degraded"
                      : "up",
                )}`,
              }}
              aria-hidden
            />
            {overall}
          </span>
          {data?.checked_at ? (
            <span>
              Checked{" "}
              {new Date(data.checked_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "medium",
              })}
            </span>
          ) : null}
          {data?.duration_ms != null ? (
            <span>Server {data.duration_ms}ms</span>
          ) : null}
          {lastClientMs != null ? <span>Client {lastClientMs}ms</span> : null}
          <button
            type="button"
            onClick={load}
            disabled={isPending}
            className="focus-ring rounded-sm border border-[var(--line)] px-3 py-1 text-sand transition-colors hover:border-seafoam hover:text-sand disabled:opacity-50"
          >
            {isPending ? "Checking…" : "Refresh"}
          </button>
        </div>
        {error ? (
          <p className="mt-4 text-sm" style={{ color: "#e07070" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {(data?.checks ?? []).map((check, i) => (
          <li
            key={check.id}
            className="rise flex flex-col gap-2 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
            style={{ animationDelay: `${0.05 * (i + 1)}s` }}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: stateColor(check.state) }}
                  aria-hidden
                />
                <h2 className="font-medium text-sand">{check.name}</h2>
                <span className="text-xs tracking-wide text-sand-muted uppercase">
                  {check.severity}
                </span>
              </div>
              <p className="mt-1 text-sm text-sand-muted">{check.description}</p>
              <p className="mt-1 font-mono text-xs text-sand-muted">
                {check.method} {check.path}
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p
                className="text-sm font-medium"
                style={{ color: stateColor(check.state) }}
              >
                {stateLabel(check.state)}
              </p>
              <p className="mt-1 text-xs text-sand-muted">{check.detail}</p>
              {check.statusCode != null ? (
                <p className="mt-1 font-mono text-xs text-sand-muted">
                  HTTP {check.statusCode}
                  {check.latencyMs != null ? ` · ${check.latencyMs}ms` : ""}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!data && !error ? (
        <p className="mt-8 text-sm text-sand-muted">Running readiness probes…</p>
      ) : null}

      <p className="mt-10 max-w-2xl text-sm text-sand-muted">
        {data?.note ||
          "Probes never scrape jobs or call AI. Auto-refresh every 30 seconds."}{" "}
        Auto-refresh every {REFRESH_MS / 1000}s.
      </p>
    </section>
  );
}

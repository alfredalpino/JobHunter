import type { Job } from "../types";
import type { ExportContext, ExportManifest } from "./types";
import { jobsToExportRows } from "./normalize";

export function buildManifest(
  jobs: Job[],
  ctx: ExportContext,
): ExportManifest {
  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    candidateName: ctx.candidateName || "candidate",
    scope: ctx.scope,
    filterSummary: ctx.filterSummary,
    jobCount: jobs.length,
  };
}

export function jobsToJson(jobs: Job[], ctx: ExportContext): string {
  const manifest = buildManifest(jobs, ctx);
  const rows = jobsToExportRows(jobs, ctx.applied);
  return JSON.stringify({ manifest, jobs: rows }, null, 2);
}

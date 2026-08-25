import { getJobStatus } from "../applied";
import type { AppliedRecord, Job } from "../types";
import type { ExportRow } from "./types";

const SUMMARY_MAX = 400;

export function truncateSummary(text: string, max = SUMMARY_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function jobToExportRow(
  job: Job,
  applied: Record<string, AppliedRecord>,
): ExportRow {
  return {
    band: job.match?.band || "?",
    score: job.score ?? 0,
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    portal: job.portal || "",
    posted_at: job.posted_at || "",
    posted_age_days: job.posted_age_days ?? null,
    recency_bucket: job.recency_bucket || "",
    status: getJobStatus(job.url, applied),
    url: job.url || "",
    query: job.query || "",
    summary: truncateSummary(job.summary || ""),
    title_matched: (job.match?.title_matched || []).join("; "),
    skills_matched: (job.match?.skills_matched || []).join("; "),
    eligible: job.eligible ?? false,
    reject_reason: job.reject_reason || "",
    ai_note: job.ai_note || "",
  };
}

export function jobsToExportRows(
  jobs: Job[],
  applied: Record<string, AppliedRecord>,
): ExportRow[] {
  return jobs.map((j) => jobToExportRow(j, applied));
}

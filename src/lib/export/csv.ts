import type { Job } from "../types";
import type { ExportContext, ExportRow } from "./types";
import { jobsToExportRows } from "./normalize";

const CSV_HEADERS: (keyof ExportRow)[] = [
  "band",
  "score",
  "title",
  "company",
  "location",
  "portal",
  "posted_at",
  "posted_age_days",
  "recency_bucket",
  "status",
  "url",
  "query",
  "summary",
  "title_matched",
  "skills_matched",
  "eligible",
  "reject_reason",
  "ai_note",
];

/** Escape CSV cell; prefix formula-injection chars for Excel safety. */
export function escapeCsvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: ExportRow[]): string {
  const header = CSV_HEADERS.join(",");
  const body = rows.map((row) =>
    CSV_HEADERS.map((h) => escapeCsvCell(row[h])).join(","),
  );
  return [header, ...body].join("\n");
}

export function jobsToCsv(jobs: Job[], ctx: ExportContext): string {
  const rows = jobsToExportRows(jobs, ctx.applied);
  return rowsToCsv(rows);
}

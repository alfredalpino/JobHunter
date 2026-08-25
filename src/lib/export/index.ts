import type { Job } from "../types";
import type { ExportContext, ExportFormat } from "./types";
import { jobsToCsv } from "./csv";
import { downloadText, estimateBytes, formatBytes } from "./download";
import { jobsToJson } from "./json";
import { jobsToMarkdown } from "./markdown";
import { jobsToPlainText } from "./whatsapp";

export * from "./types";
export * from "./normalize";
export * from "./csv";
export * from "./download";
export * from "./markdown";
export * from "./json";
export * from "./whatsapp";
export * from "./clipboard";
export * from "./shareLink";

export function formatJobs(
  jobs: Job[],
  format: ExportFormat,
  ctx: ExportContext,
): string {
  switch (format) {
    case "markdown":
      return jobsToMarkdown(jobs, ctx);
    case "csv":
      return jobsToCsv(jobs, ctx);
    case "json":
      return jobsToJson(jobs, ctx);
    case "text":
      return jobsToPlainText(jobs, ctx);
    default:
      return jobsToPlainText(jobs, ctx);
  }
}

export function exportFilename(
  format: ExportFormat,
  candidateName?: string,
): string {
  const slug = (candidateName || "jobs")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const ext = format === "markdown" ? "md" : format;
  const date = new Date().toISOString().slice(0, 10);
  return `jobs-${slug}-${date}.${ext}`;
}

export function mimeForFormat(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv;charset=utf-8";
    case "json":
      return "application/json;charset=utf-8";
    case "markdown":
      return "text/markdown;charset=utf-8";
    default:
      return "text/plain;charset=utf-8";
  }
}

export function previewExportSize(
  jobs: Job[],
  format: ExportFormat,
  ctx: ExportContext,
): { bytes: number; label: string; jobCount: number } {
  const content = formatJobs(jobs, format, ctx);
  const bytes = estimateBytes(content);
  return { bytes, label: formatBytes(bytes), jobCount: jobs.length };
}

export function downloadJobs(
  jobs: Job[],
  format: ExportFormat,
  ctx: ExportContext,
): void {
  const content = formatJobs(jobs, format, ctx);
  downloadText(exportFilename(format, ctx.candidateName), content, mimeForFormat(format));
}

import type { Job } from "../types";
import type { ExportContext } from "./types";
import { jobToExportRow } from "./normalize";

export function jobsToMarkdown(
  jobs: Job[],
  ctx: ExportContext,
  title?: string,
): string {
  const heading =
    title || `Job listings — ${ctx.candidateName || "candidate"}`;
  const lines = [
    `# ${heading}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    ctx.filterSummary ? `Filters: ${ctx.filterSummary}` : "",
    `Scope: ${ctx.scope} · ${jobs.length} jobs`,
    "",
    "_Apply on the original posting site. JobHunter does not auto-apply._",
    "",
  ].filter(Boolean);

  for (const job of jobs) {
    const row = jobToExportRow(job, ctx.applied);
    lines.push(`## [${row.band}] ${row.title}`);
    lines.push(`- Company: ${row.company || "—"}`);
    lines.push(`- Location: ${row.location || "—"}`);
    lines.push(`- Portal: ${row.portal || "—"}`);
    lines.push(
      `- Posted: ${row.posted_at || "—"} (~${row.posted_age_days ?? "?"}d)`,
    );
    lines.push(`- Status: ${row.status}`);
    lines.push(`- Score: ${row.score}`);
    if (row.title_matched) lines.push(`- Title match: ${row.title_matched}`);
    if (row.skills_matched) lines.push(`- Skills: ${row.skills_matched}`);
    if (row.ai_note) lines.push(`- Note: ${row.ai_note}`);
    if (!row.eligible && row.reject_reason) {
      lines.push(`- Not eligible: ${row.reject_reason}`);
    }
    if (row.summary) lines.push(`- Summary: ${row.summary}`);
    lines.push(`- Link: ${row.url}`);
    lines.push("");
  }
  return lines.join("\n");
}

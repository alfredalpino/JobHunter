import type { Job } from "../types";
import type { ExportContext } from "./types";
import { jobToExportRow } from "./normalize";
import { WHATSAPP_CHUNK_CHARS } from "./types";

export function formatJobCompact(job: Job, ctx: ExportContext): string {
  const row = jobToExportRow(job, ctx.applied);
  const age =
    row.posted_age_days != null ? `${row.posted_age_days}d` : "?d";
  const loc = row.location ? ` · ${row.location}` : "";
  return `[${row.band}] ${row.title} — ${row.company || "—"}\n${loc.trim() || "Remote"} · ${age} · Score ${row.score}\n${row.url}`;
}

export function jobsToPlainText(jobs: Job[], ctx: ExportContext): string {
  const header = [
    `Job listings (${jobs.length})`,
    ctx.candidateName ? `For: ${ctx.candidateName}` : "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Apply on the original site — JobHunter does not auto-apply.",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const blocks = jobs.map((j, i) => {
    const block = formatJobCompact(j, ctx);
    return `${i + 1}. ${block}`;
  });
  return `${header}\n${blocks.join("\n\n")}`;
}

/** Split plain text into WhatsApp-safe chunks (URL length limits). */
export function chunkForWhatsApp(
  text: string,
  maxChars = WHATSAPP_CHUNK_CHARS,
): string[] {
  if (text.length <= maxChars) return [text];

  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else if (line.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push(line.slice(i, i + maxChars));
      }
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

export function whatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

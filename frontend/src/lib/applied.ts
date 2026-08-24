import type { AppliedRecord, Job, JobStatus } from "./types";

const APPLIED_KEY = "jobhunter.applied.v1";

export function loadAppliedMap(): Record<string, AppliedRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AppliedRecord>;
  } catch {
    return {};
  }
}

export function saveAppliedMap(map: Record<string, AppliedRecord>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(APPLIED_KEY, JSON.stringify(map));
}

export function setJobStatus(
  url: string,
  status: JobStatus,
  map?: Record<string, AppliedRecord>,
): Record<string, AppliedRecord> {
  const next = { ...(map || loadAppliedMap()) };
  next[url] = { status, updatedAt: new Date().toISOString() };
  saveAppliedMap(next);
  return next;
}

export function getJobStatus(
  url: string,
  map: Record<string, AppliedRecord>,
): JobStatus {
  return map[url]?.status || "new";
}

/** Top N eligible jobs not yet applied/skipped/ghosted. */
export function todaysQueue(
  jobs: Job[],
  map: Record<string, AppliedRecord>,
  n = 10,
): Job[] {
  const blocked = new Set(["applied", "skipped", "ghosted"]);
  return jobs
    .filter((j) => j.url && !blocked.has(getJobStatus(j.url, map)))
    .slice(0, n);
}

export function jobsToMarkdown(
  jobs: Job[],
  map: Record<string, AppliedRecord>,
  title = "Eligible jobs",
): string {
  const lines = [`# ${title}`, "", `Generated: ${new Date().toISOString()}`, ""];
  for (const j of jobs) {
    const st = getJobStatus(j.url, map);
    const band = j.match?.band || "?";
    const why = [
      ...(j.match?.title_matched || []).slice(0, 2),
      ...(j.match?.skills_matched || []).slice(0, 3),
    ].join(", ");
    lines.push(`## [${band}] ${j.title}`);
    lines.push(`- Company: ${j.company || "—"}`);
    lines.push(`- Location: ${j.location || "—"}`);
    lines.push(`- Posted: ${j.posted_at || "—"} (~${j.posted_age_days ?? "?"}d)`);
    lines.push(`- Status: ${st}`);
    lines.push(`- Score: ${j.score ?? 0}`);
    if (why) lines.push(`- Why: ${why}`);
    lines.push(`- Link: ${j.url}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

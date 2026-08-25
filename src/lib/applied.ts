import type { AppliedRecord, Job, JobStatus } from "./types";

export { downloadText } from "./export/download";
export { jobsToMarkdown } from "./export/markdown";

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

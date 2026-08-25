import type { AppliedRecord, DateWindowId, Job, JobStatus, Preferences, Profile } from "./types";
import { DATE_WINDOWS } from "./preferences";
import { guessRegionFromLocation, isNonProfessionalTitle } from "./resume";
import { getRegion } from "./config";
import { getJobStatus } from "./applied";

const TITLE_JUNK =
  /\b(supported|assisted|helped|managed|responsible|worked|using|with data|during|including)\b/i;
const TITLE_ROLE =
  /\b(engineer|analyst|developer|administrator|support|specialist|manager|designer|consultant|coordinator|associate|architect|scientist|recruiter|accountant|noc|network|devops|intern)\b/i;

const SENIOR_EXCLUDES = [
  "senior",
  "sr.",
  "staff",
  "principal",
  "director",
  "head of",
  "vice president",
  "vp",
  "chief",
  "executive",
  "manager",
];

/** Split comma- or newline-separated lists; drop sentence-like junk. */
export function splitListInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter((x) => x.length >= 2 && x.length <= 72)
    .filter((x) => !TITLE_JUNK.test(x) || TITLE_ROLE.test(x))
    .filter(
      (x, i, arr) =>
        arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i,
    );
}

/** User-entered keyword lists (excludes, skills, locations) — no title heuristics. */
export function splitKeywordListInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter((x) => x.length >= 1 && x.length <= 72)
    .filter(
      (x, i, arr) =>
        arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i,
    );
}

export function sanitizeTargetTitles(titles: string[]): string[] {
  return splitListInput(titles.join("\n")).filter(
    (t) => !isNonProfessionalTitle(t),
  );
}

export function jobLevelToSeniorityBand(level: string | undefined): string {
  const map: Record<string, string> = {
    junior: "junior",
    mid: "mid",
    senior: "senior",
    lead: "lead",
    executive: "executive",
  };
  return map[(level || "mid").toLowerCase()] || "mid";
}

export function seniorityBandToJobLevel(band: string | undefined): string {
  const map: Record<string, string> = {
    intern: "junior",
    junior: "junior",
    mid: "mid",
    senior: "senior",
    lead: "lead",
    executive: "executive",
  };
  return map[(band || "mid").toLowerCase()] || "mid";
}

export function filterJobsByWindow(
  jobs: Job[],
  windowId: DateWindowId,
): Job[] {
  const w = DATE_WINDOWS.find((d) => d.id === windowId);
  if (!w || windowId === "any_age") return jobs;
  return jobs.filter((j) => {
    const age = j.posted_age_days;
    if (age == null) {
      return windowId === "all_fresh" || windowId === "one_month";
    }
    return age >= w.minDays && age <= w.maxDays;
  });
}

export type JobFilterOptions = {
  fitFilter: "eligible" | "all";
  dateFilter: DateWindowId;
  showBandC: boolean;
  statusFilter: "all" | JobStatus;
  applied: Record<string, AppliedRecord>;
  workModeFilter?: Preferences["work_mode"];
};

export const WORK_MODE_OPTIONS: {
  value: Preferences["work_mode"];
  label: string;
}[] = [
  { value: "any", label: "Any (remote + hybrid + onsite)" },
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site / office" },
];

function jobWorkModeBlob(job: Job): string {
  return [job.title, job.company, job.location, job.summary]
    .join(" ")
    .toLowerCase();
}

/** Client-side work-mode filter on scraped listings (location + summary text). */
export function jobMatchesWorkModeFilter(
  job: Job,
  mode: Preferences["work_mode"] | undefined,
): boolean {
  if (!mode || mode === "any") return true;
  const blob = jobWorkModeBlob(job);
  const loc = (job.location || "").trim().toLowerCase();
  const remote =
    /\b(remote|work from home|wfh|distributed|anywhere|worldwide)\b/i.test(
      blob,
    ) || loc === "remote";
  const hybrid = /\bhybrid\b/i.test(blob);
  const onsite =
    /\b(on-?site|in-?office|office[- ]based|in person|in-person)\b/i.test(
      blob,
    );
  const remoteOnly =
    /\b(remote[- ]only|100% remote|fully remote|work from home only)\b/i.test(
      blob,
    );

  if (mode === "remote") {
    if (hybrid) return false;
    return remote || loc === "remote";
  }
  if (mode === "hybrid") {
    return hybrid || (remote && onsite);
  }
  if (mode === "onsite") {
    if (remoteOnly || loc === "remote") return false;
    if (onsite) return true;
    return !remote && Boolean(loc) && loc !== "remote";
  }
  return true;
}

/** Single-pass UI filter — avoids chaining multiple .filter() scans. */
export function applyJobFilters(jobs: Job[], opts: JobFilterOptions): Job[] {
  const w = DATE_WINDOWS.find((d) => d.id === opts.dateFilter);
  const checkDate = w && opts.dateFilter !== "any_age";
  const hideBandC = !opts.showBandC && opts.fitFilter === "eligible";
  const checkStatus = opts.statusFilter !== "all";
  const out: Job[] = [];

  for (const j of jobs) {
    if (opts.fitFilter === "eligible" && !j.eligible) continue;
    if (checkDate && w) {
      const age = j.posted_age_days;
      if (age == null) {
        if (opts.dateFilter !== "all_fresh" && opts.dateFilter !== "one_month") {
          continue;
        }
      } else if (age < w.minDays || age > w.maxDays) {
        continue;
      }
    }
    if (hideBandC && j.match?.band === "C") continue;
    if (checkStatus && getJobStatus(j.url, opts.applied) !== opts.statusFilter) {
      continue;
    }
    if (!jobMatchesWorkModeFilter(j, opts.workModeFilter)) continue;
    out.push(j);
  }
  return out;
}

export type JobBucketGroups = Record<string, Job[]>;

/** Partition visible jobs into recency buckets in one pass. */
export function partitionJobsByBucket(jobs: Job[]): JobBucketGroups {
  const groups: JobBucketGroups = {
    last_7_days: [],
    days_8_to_14: [],
    days_15_to_21: [],
    days_22_to_30: [],
    older: [],
    unknown: [],
  };
  for (const j of jobs) {
    const b = j.recency_bucket || "unknown";
    if (groups[b]) groups[b].push(j);
    else groups.unknown.push(j);
  }
  return groups;
}

/** Infer remote preference from resume text. */
function inferWorkMode(blob: string): Preferences["work_mode"] {
  const remote =
    /\b(remote|work from home|wfh|distributed|anywhere|worldwide)\b/i.test(blob);
  const hybrid = /\bhybrid\b/i.test(blob);
  const onsite = /\b(on-?site|office based|in-office)\b/i.test(blob);
  if (remote && !hybrid && !onsite) return "remote";
  if (hybrid) return "hybrid";
  if (onsite && !remote) return "onsite";
  return "any";
}

/**
 * After resume analysis, seed preferences from extracted profile fields.
 * Keeps user-edited prefs where profile has nothing new to add.
 */
export function mergeProfileIntoPrefs(
  profile: Profile,
  prefs: Preferences,
): Preferences {
  const regionGuess = guessRegionFromLocation(
    profile.candidate.location || prefs.region,
  );
  const useRegion =
    prefs.region === "dubai" && regionGuess !== "dubai"
      ? regionGuess
      : prefs.region || regionGuess;

  const pack = getRegion(useRegion);
  const band = jobLevelToSeniorityBand(profile.experience.max_job_level);
  const blob = [
    profile.raw_excerpt,
    profile.candidate.location,
    ...(profile.target_titles || []),
  ]
    .join(" ")
    .toLowerCase();

  const exclude = [...(prefs.exclude_titles || [])];
  if (band === "junior" || band === "intern") {
    for (const sig of SENIOR_EXCLUDES) {
      if (!exclude.some((e) => e.toLowerCase() === sig)) exclude.push(sig);
    }
  }

  return {
    ...prefs,
    region: useRegion,
    locations:
      prefs.locations?.length > 0
        ? prefs.locations
        : pack
          ? [...pack.locations]
          : profile.candidate.location
            ? [profile.candidate.location]
            : [],
    country_indeed: pack?.country_indeed || prefs.country_indeed,
    target_titles: sanitizeTargetTitles(profile.target_titles).slice(0, 8),
    must_have_skills: profile.skills_positive.slice(0, 16),
    seniority_band: band,
    work_auth: profile.candidate.work_auth || prefs.work_auth || "",
    work_mode:
      prefs.work_mode && prefs.work_mode !== "any"
        ? prefs.work_mode
        : inferWorkMode(blob),
    date_window: prefs.date_window || "all_fresh",
    recency_max_days: prefs.recency_max_days || 14,
    exclude_titles: exclude.slice(0, 24),
  };
}

export const FILTER_SELECT_CLASS =
  "glass-input focus-ring mt-1 w-full px-3 py-2.5 text-sm";

export const FILTER_SELECT_COMPACT =
  "glass-input focus-ring rounded-lg px-2.5 py-1.5 text-sm min-w-[9rem]";

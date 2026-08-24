import type { Job, RecencyBucket } from "./types";
import { DEFAULT_RECENCY } from "./config";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export function parsePostedAgeDays(
  text: string,
  today: Date = todayUTC(),
): { age: number | null; evidence: string } {
  const t = (text || "").toLowerCase().replace(/[–—]/g, "-");

  let m = t.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!Number.isNaN(d.getTime())) {
      return { age: daysBetween(today, d), evidence: m[0] };
    }
  }

  const monthDay = t.match(
    /\b(?:posted\s+(?:on\s+)?)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/,
  );
  if (monthDay) {
    const mon = MONTHS[monthDay[1]] ?? MONTHS[monthDay[1].slice(0, 3)];
    if (mon) {
      let year = monthDay[3] ? +monthDay[3] : today.getUTCFullYear();
      let d = new Date(Date.UTC(year, mon - 1, +monthDay[2]));
      if (!monthDay[3] && d > today) {
        d = new Date(Date.UTC(year - 1, mon - 1, +monthDay[2]));
      }
      if (!Number.isNaN(d.getTime())) {
        return { age: daysBetween(today, d), evidence: monthDay[0] };
      }
    }
  }

  if (/^\d{10}$/.test(text.trim())) {
    const d = new Date(+text.trim() * 1000);
    if (!Number.isNaN(d.getTime())) {
      return {
        age: daysBetween(
          today,
          new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
          ),
        ),
        evidence: `epoch:${text.trim()}`,
      };
    }
  }
  if (/^\d{13}$/.test(text.trim())) {
    const d = new Date(+text.trim());
    if (!Number.isNaN(d.getTime())) {
      return {
        age: daysBetween(
          today,
          new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
          ),
        ),
        evidence: `epoch_ms:${text.trim()}`,
      };
    }
  }

  if (
    /\b(just posted|posted today|today|hours?\s+ago|minutes?\s+ago)\b/.test(t)
  ) {
    return { age: 0, evidence: "today/hours-ago" };
  }
  if (/\byesterday\b/.test(t)) return { age: 1, evidence: "yesterday" };
  m = t.match(/\b(\d+)\s*hours?\s+ago\b/);
  if (m) return { age: 0, evidence: m[0] };
  m = t.match(/\b(\d+)\s*days?\s+ago\b/);
  if (m) return { age: +m[1], evidence: m[0] };
  m = t.match(/\b(\d+)\s*weeks?\s+ago\b/);
  if (m) return { age: +m[1] * 7, evidence: m[0] };
  m = t.match(/\b(\d+)\s*months?\s+ago\b/);
  if (m) return { age: +m[1] * 30, evidence: m[0] };
  if (/\bthis\s+week\b/.test(t)) return { age: 3, evidence: "this week" };
  if (/\blast\s+week\b/.test(t)) return { age: 7, evidence: "last week" };

  return { age: null, evidence: "" };
}

function bucketForAge(age: number | null, week1: number): RecencyBucket {
  if (age === null) return "unknown";
  if (age < 0) return "unknown";
  if (age <= week1) return "last_7_days";
  if (age <= 14) return "days_8_to_14";
  if (age <= 21) return "days_15_to_21";
  if (age <= 30) return "days_22_to_30";
  return "older";
}

/**
 * Annotate age/bucket only — never reject. Age filters belong in the UI.
 */
export function annotateRecency(
  job: Job,
  opts?: { week_1_days?: number },
): Job {
  const week1 = opts?.week_1_days ?? DEFAULT_RECENCY.bucket_week_1_days;
  const blob = [job.posted_at, job.title, job.summary, job.location]
    .filter(Boolean)
    .join(" ");

  let parsed = job.posted_at
    ? parsePostedAgeDays(job.posted_at)
    : { age: null as number | null, evidence: "" };
  if (parsed.age === null) {
    parsed = parsePostedAgeDays(blob);
  }

  job.posted_age_days = parsed.age;
  job.recency_bucket = bucketForAge(parsed.age, week1);
  return job;
}

/** @deprecated use annotateRecency — kept for tests that check age parsing */
export function checkRecency(
  job: Job,
  opts?: {
    max_age_days?: number;
    reject_unknown?: boolean;
    week_1_days?: number;
  },
): { ok: boolean; reason: string; age: number | null; bucket: RecencyBucket } {
  annotateRecency(job, { week_1_days: opts?.week_1_days });
  const age = job.posted_age_days ?? null;
  const bucket = job.recency_bucket || "unknown";
  const maxAge = opts?.max_age_days;
  const rejectUnknown = opts?.reject_unknown ?? false;

  if (age === null) {
    if (rejectUnknown) {
      return {
        ok: false,
        reason: "REJECT: no posting date (unknown/missing)",
        age: null,
        bucket: "unknown",
      };
    }
    return {
      ok: true,
      reason: "posted_at:unknown (allowed)",
      age: null,
      bucket: "unknown",
    };
  }
  if (maxAge != null && age > maxAge) {
    return {
      ok: false,
      reason: `REJECT: older than ${maxAge}d (~${age}d)`,
      age,
      bucket,
    };
  }
  return { ok: true, reason: `age:~${age}d`, age, bucket };
}

export function applyRecency(job: Job, profileRecency?: ProfileRecency): Job {
  // Web product: annotate only — do not hard-reject by age.
  return annotateRecency(job, {
    week_1_days: profileRecency?.bucket_week_1_days,
  });
}

type ProfileRecency = {
  max_age_days?: number;
  reject_unknown_date?: boolean;
  bucket_week_1_days?: number;
};

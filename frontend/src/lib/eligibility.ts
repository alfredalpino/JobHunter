import { DEFAULT_SCORING } from "./config";
import { annotateRecency } from "./recency";
import {
  compileTitleMatcher,
  matchTitleCompiled,
  type CompiledTitleMatcher,
} from "./roleFamilies";
import { rejectForSeniority } from "./seniority";
import type { Job, MatchReason, Profile, ScoreBand } from "./types";

const JUNIOR =
  /\b(junior|jr\.?|entry[\s-]?level|intern|graduate|new grad|noc l1|l1)\b/i;
const ASSOCIATE = /\bassociate\b/i;
const YEAR_RANGE =
  /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi;
const YEAR_PLUS =
  /(?:at least|minimum|min\.?|over|more than)?\s*(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/gi;
const YEAR_EXP =
  /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp\.?)/gi;
const HUB_TITLE =
  /(jobs in |job vacancies|\d{2,}\+?\s+\w+\s+jobs|salary guide|salaries|what .+ jobs are|open job preview|courses? in |page \d+|top companies)/i;
const HUB_URL =
  /(\/salaries\/|\/salary-guide|\/roles\/|\/q-[^/]+-jobs|\/Job\/[^/]*SRCH_|\/search\?|\/jobs\?|\/course\/|\/courses\.|\/explore\/)/i;

type CompiledScoreContext = {
  titleMatcher: CompiledTitleMatcher;
  exclude: string[];
  skills: string[];
  geoAllow: string[];
  geoReject: string[];
  scoring: typeof DEFAULT_SCORING;
  maxYearsCap: number;
  minKeep: number;
  targetTitlesLower: string[];
  midBoostEligible: boolean;
};

function compileScoreContext(profile: Profile): CompiledScoreContext {
  const scoring = { ...DEFAULT_SCORING, ...(profile.scoring || {}) };
  return {
    titleMatcher: compileTitleMatcher(profile),
    exclude: (profile.exclude_title_signals || []).map((s) => s.toLowerCase()),
    skills: (profile.skills_positive || []).map((s) => s.toLowerCase()),
    geoAllow: (profile.geo?.allow_signals || []).map((s) => s.toLowerCase()),
    geoReject: (profile.geo?.reject_signals || []).map((s) => s.toLowerCase()),
    scoring,
    maxYearsCap: Number(profile.experience?.max_years_required ?? 3),
    minKeep: scoring.min_score_to_keep,
    targetTitlesLower: (profile.target_titles || []).map((t) =>
      t.toLowerCase(),
    ),
    midBoostEligible:
      !!profile.experience?.credibility &&
      profile.experience?.max_job_level === "mid",
  };
}

function hasPhrase(text: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (p.includes(" ") || p.length > 4) return text.includes(p);
  return new RegExp(`\\b${escapeReg(p)}\\b`, "i").test(text);
}

function maxYears(text: string): number | null {
  const t = text.toLowerCase().replace(/[–—]/g, "-");
  const floors: number[] = [];
  for (const m of t.matchAll(YEAR_RANGE)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_PLUS)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_EXP)) floors.push(parseFloat(m[1]));
  if (!floors.length) return JUNIOR.test(t) ? 0 : null;
  return Math.max(...floors);
}

function isHub(job: Job): boolean {
  if (HUB_TITLE.test(job.title || "")) return true;
  const url = job.url || "";
  if (
    HUB_URL.test(url) &&
    !url.includes("viewjob") &&
    !url.toLowerCase().includes("/job/")
  ) {
    return true;
  }
  return false;
}

function blobOf(job: Job): string {
  return [job.title, job.company, job.location, job.summary, job.url]
    .join(" ")
    .toLowerCase();
}

function bandFor(score: number, titleStrong: boolean): ScoreBand {
  if (score >= 70 && titleStrong) return "A";
  if (score >= 50) return "B";
  return "C";
}

/** Canonical fingerprint — matches Python `_dedupe_key` intent. */
export function jobFingerprint(job: Job): string {
  let host = "";
  try {
    host = new URL(job.url || "https://invalid.local").hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    host = "unknown";
  }
  const title = (job.title || "").toLowerCase().replace(/\s+/g, " ").trim();
  const company = (job.company || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${host}|${title}|${company}`;
}

/**
 * Score + annotate every job. Hard mismatches set eligible=false but the job
 * is still returned so the UI can show "all scraped" vs "eligible only".
 * Age is NEVER a hard reject — date windows are UI filters.
 */
export function scoreJob(
  job: Job,
  profile: Profile,
  ctx?: CompiledScoreContext,
): Job {
  const compiled = ctx || compileScoreContext(profile);
  const scored: Job = { ...job };
  if (scored.posted_at?.includes("T")) {
    scored.posted_at = scored.posted_at.slice(0, 10);
  }
  annotateRecency(scored, {
    week_1_days: profile.recency?.bucket_week_1_days,
  });

  if (isHub(scored)) {
    scored.reject_reason = "search hub / salary / course page";
    scored.eligible = false;
    scored.score = 0;
    scored.match = {
      title_matched: [],
      skills_matched: [],
      geo_matched: false,
      seniority_ok: true,
      score: 0,
      band: "C",
    };
    return scored;
  }

  const blob = blobOf(scored);
  const title = (scored.title || "").toLowerCase();
  const { scoring, maxYearsCap, minKeep } = compiled;

  let reject = "";
  let seniorityOk = true;

  const hardExclude = compiled.exclude.filter((s) => s !== "associate");
  if (hardExclude.some((sig) => hasPhrase(title, sig))) {
    reject = "senior or unrelated title";
  }

  const seniorityReason = rejectForSeniority(scored.title || "", profile);
  if (!reject && seniorityReason) {
    reject = seniorityReason;
    seniorityOk = false;
  }

  const titleMatch = matchTitleCompiled(
    scored.title || "",
    compiled.titleMatcher,
  );
  if (!reject && !titleMatch.ok) {
    reject = "title outside aspirant role family";
  }

  if (!reject) {
    for (const sig of compiled.geoReject) {
      if (sig && blob.includes(sig)) {
        reject = `geo lock: ${sig}`;
        break;
      }
    }
  }

  const years = maxYears(blob);
  if (
    !reject &&
    years != null &&
    years > maxYearsCap &&
    !JUNIOR.test(title)
  ) {
    reject = `requires ${years}+ years (cap ${maxYearsCap})`;
  }

  const skillsMatched = compiled.skills.filter(
    (s) => s && s.length > 2 && blob.includes(s),
  );
  const geoMatched = compiled.geoAllow.some((g) => g && blob.includes(g));

  let score = 0;
  if (titleMatch.ok) score += scoring.title_weight;
  score += Math.min(scoring.skills_weight, 5 * skillsMatched.length);
  if (JUNIOR.test(title) || ASSOCIATE.test(title)) {
    score += scoring.junior_boost;
  }
  if (
    compiled.midBoostEligible &&
    !/\b(senior|sr\.?|staff|principal|director|head of|chief|vp)\b/i.test(title)
  ) {
    if (titleMatch.ok) score += scoring.mid_boost;
  }
  if (geoMatched) score += scoring.geo_boost;

  const titleStrong =
    titleMatch.matched.some((m) => m.includes(" ")) ||
    compiled.targetTitlesLower.some((t) => title.includes(t));

  const match: MatchReason = {
    title_matched: titleMatch.matched,
    skills_matched: skillsMatched.slice(0, 8),
    geo_matched: geoMatched,
    seniority_ok: seniorityOk,
    score,
    band: bandFor(score, titleStrong && titleMatch.ok),
  };

  scored.score = score;
  scored.match = match;

  if (reject) {
    scored.eligible = false;
    scored.reject_reason = reject;
    return scored;
  }

  scored.eligible = score >= minKeep;
  scored.reject_reason = scored.eligible
    ? ""
    : `score ${score} below ${minKeep}`;
  return scored;
}

/** Score every unique fingerprint — never drop by age. */
export function scoreAllJobs(jobs: Job[], profile: Profile): Job[] {
  const ctx = compileScoreContext(profile);
  const seenUrl = new Set<string>();
  const seenFp = new Set<string>();
  const out: Job[] = [];
  for (const job of jobs) {
    if (!job.url || seenUrl.has(job.url)) continue;
    const fp = jobFingerprint(job);
    if (seenFp.has(fp)) continue;
    seenUrl.add(job.url);
    seenFp.add(fp);
    out.push(scoreJob(job, profile, ctx));
  }
  out.sort((a, b) => {
    if (!!b.eligible !== !!a.eligible) return a.eligible ? -1 : 1;
    const bandOrder = { A: 0, B: 1, C: 2 };
    const ba = bandOrder[a.match?.band || "C"];
    const bb = bandOrder[b.match?.band || "C"];
    if (ba !== bb) return ba - bb;
    return (b.score || 0) - (a.score || 0);
  });
  return out;
}

/** Eligible-only view (for tests / optional server filter). */
export function filterEligible(jobs: Job[], profile: Profile): Job[] {
  return scoreAllJobs(jobs, profile).filter((j) => j.eligible);
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

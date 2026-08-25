import { DEFAULT_SCORING } from "./config";
import { annotateRecency } from "./recency";
import {
  compileTitleMatcher,
  detectProfileFamilies,
  matchTitleCompiled,
  type CompiledTitleMatcher,
} from "./roleFamilies";
import {
  compileSeniorityGate,
  rejectForSeniorityWithGate,
  type SeniorityGate,
} from "./seniority";
import type { Job, MatchReason, Profile, ScoreBand } from "./types";

const JUNIOR =
  /\b(junior|jr\.?|entry[\s-]?level|intern|graduate|new grad|noc l1|l1)\b/i;
const ASSOCIATE = /\bassociate\b/i;
const YEAR_RANGE =
  /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi;
/** "5+ years", "at least 5+ years" */
const YEAR_PLUS =
  /(?:at least|minimum|min\.?|over|more than)?\s*(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/gi;
/**
 * "5 years experience", "5 years' experience", "5 years of exp"
 * Apostrophe/curly quote after years is common in UK/Caribbean postings.
 */
const YEAR_EXP =
  /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)['’]?\s*(?:of\s+)?(?:experience|exp\.?)/gi;
/** "minimum of 5 years", "at least 3 yrs", "up to a minimum of 5 years" */
const YEAR_MINIMUM_OF =
  /(?:up\s+to\s+a\s+)?(?:minimum|at\s+least|min\.?|over|more\s+than|requires?|requiring)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi;
/** "5 years in the cable industry", "3 years with HFC" — floor without "experience" word */
const YEAR_IN_FIELD =
  /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)['’]?\s+(?:in|with)\b/gi;
const HUB_TITLE =
  /(jobs in |job vacancies|\d{2,}\+?\s+\w+\s+jobs|salary guide|salaries|what .+ jobs are|open job preview|courses? in |page \d+|top companies)/i;
const HUB_URL =
  /(\/salaries\/|\/salary-guide|\/roles\/|\/q-[^/]+-jobs|\/Job\/[^/]*SRCH_|\/search\?|\/jobs\?|\/course\/|\/courses\.|\/explore\/)/i;

const SPAM_TITLE =
  /\b(earn \$|work from phone|mlm|pyramid|crypto trader|onlyfans|adult|18\+|be your own boss)\b/i;

/** IT job titles eligible for skills-bridge when title family doesn't match verbatim. */
const IT_JOB_TITLE =
  /\b(engineer|analyst|administrator|architect|developer|support|technician|specialist|devops|sre|noc|network|security|sysadmin|consultant)\b/i;

const NON_IT_TITLE =
  /\b(instructor|teacher|professor|tutor|coach|recruiter|sales|marketing|account executive|copywriter|writer|designer|hr\b|human resources|nanny|driver|waiter)\b/i;

/** Pure security titles — blocked for network-focused profiles unless network appears in title. */
const SECURITY_ONLY_TITLE =
  /\b(application security|appsec|cybersecurity|security engineer|soc analyst|penetration|infosec)\b/i;

const NETWORK_TITLE_HINT =
  /\b(network|noc|telecom|field technician|cisco|routing|switching|broadband|fiber|isp)\b/i;

type SkillMatcher = (blob: string) => boolean;

export type CompiledScoreContext = {
  titleMatcher: CompiledTitleMatcher;
  exclude: string[];
  excludeTitleCheckers: Array<(title: string) => boolean>;
  skillMatchers: SkillMatcher[];
  skillsList: string[];
  mustHaveSkillCount: number;
  geoAllow: string[];
  geoReject: string[];
  scoring: typeof DEFAULT_SCORING;
  maxYearsCap: number;
  minKeep: number;
  targetTitlesLower: string[];
  midBoostEligible: boolean;
  seniorityGate: SeniorityGate;
  week1Days: number;
  networkFocused: boolean;
};

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePhraseChecker(phrase: string): (text: string) => boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return () => false;
  if (p.includes(" ") || p.length > 4) {
    return (text: string) => text.includes(p);
  }
  const re = new RegExp(`\\b${escapeReg(p)}\\b`, "i");
  return (text: string) => re.test(text);
}

function compileSkillMatcher(skill: string): SkillMatcher | null {
  const s = skill.toLowerCase().trim();
  if (!s || s.length <= 2) return null;
  if (s.includes(" ") || s.length > 5) {
    return (blob: string) => blob.includes(s);
  }
  const re = new RegExp(`\\b${escapeReg(s)}\\b`, "i");
  return (blob: string) => re.test(blob);
}

/** Compile profile once — reuse for every job in a hunt batch. */
export function compileScoreContext(profile: Profile): CompiledScoreContext {
  const scoring = { ...DEFAULT_SCORING, ...(profile.scoring || {}) };
  const exclude = (profile.exclude_title_signals || []).map((s) =>
    s.toLowerCase(),
  );
  const hardExclude = exclude.filter((s) => s !== "associate");
  const skillsList: string[] = [];
  const skillMatchers: SkillMatcher[] = [];
  for (const raw of profile.skills_positive || []) {
    const s = raw.toLowerCase().trim();
    if (s.length <= 2) continue;
    const matcher = compileSkillMatcher(s);
    if (!matcher) continue;
    skillsList.push(s);
    skillMatchers.push(matcher);
  }

  return {
    titleMatcher: compileTitleMatcher(profile),
    exclude,
    excludeTitleCheckers: hardExclude.map(compilePhraseChecker),
    skillMatchers,
    skillsList,
    mustHaveSkillCount: skillsList.length,
    geoAllow: (profile.geo?.allow_signals || []).map((s) => s.toLowerCase()),
    geoReject: (profile.geo?.reject_signals || []).map((s) => s.toLowerCase()),
    scoring,
    maxYearsCap: Number(profile.experience?.max_years_required ?? 2),
    minKeep: scoring.min_score_to_keep,
    targetTitlesLower: (profile.target_titles || []).map((t) =>
      t.toLowerCase(),
    ),
    midBoostEligible:
      !!profile.experience?.credibility &&
      profile.experience?.max_job_level === "mid",
    seniorityGate: compileSeniorityGate(profile),
    week1Days: profile.recency?.bucket_week_1_days ?? 7,
    networkFocused: (() => {
      const families = detectProfileFamilies(profile);
      const targets = (profile.target_titles || []).join(" ").toLowerCase();
      return (
        families.includes("network_ops") &&
        !families.includes("security") &&
        !/\bsecurity|cyber|appsec\b/.test(targets)
      );
    })(),
  };
}

/**
 * Lowest experience floor required by posting text.
 * Returns null when no year requirement is stated (unknown ≠ reject).
 */
export function maxYearsRequiredFromText(text: string): number | null {
  const t = text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/['’]/g, "'");
  const floors: number[] = [];
  for (const m of t.matchAll(YEAR_RANGE)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_PLUS)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_EXP)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_MINIMUM_OF)) floors.push(parseFloat(m[1]));
  for (const m of t.matchAll(YEAR_IN_FIELD)) floors.push(parseFloat(m[1]));
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

function matchSkillNames(
  blob: string,
  skills: string[],
  matchers: SkillMatcher[],
): string[] {
  const matched: string[] = [];
  for (let i = 0; i < matchers.length; i++) {
    if (matchers[i](blob)) matched.push(skills[i]);
  }
  return matched;
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
  annotateRecency(scored, { week_1_days: compiled.week1Days });

  const title = (scored.title || "").toLowerCase();

  if (isHub(scored) || SPAM_TITLE.test(title)) {
    scored.reject_reason = isHub(scored)
      ? "search hub / salary / course page"
      : "spam / non-job listing";
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
  const descBlob = [scored.company, scored.location, scored.summary]
    .join(" ")
    .toLowerCase();
  const { scoring, maxYearsCap, minKeep } = compiled;

  let reject = "";
  let seniorityOk = true;

  if (compiled.excludeTitleCheckers.some((check) => check(title))) {
    reject = "senior or unrelated title";
  }

  const seniorityReason = rejectForSeniorityWithGate(
    scored.title || "",
    compiled.seniorityGate,
  );
  if (!reject && seniorityReason) {
    reject = seniorityReason;
    seniorityOk = false;
  }

  const skillsMatchedNames = matchSkillNames(
    blob,
    compiled.skillsList,
    compiled.skillMatchers,
  );

  let titleMatch = matchTitleCompiled(
    scored.title || "",
    compiled.titleMatcher,
  );

  if (!reject && !titleMatch.ok) {
    if (
      compiled.networkFocused &&
      SECURITY_ONLY_TITLE.test(title) &&
      !NETWORK_TITLE_HINT.test(title)
    ) {
      reject = "title outside aspirant role family";
    }
  }

  if (!reject && !titleMatch.ok) {
    const skillsBridge =
      skillsMatchedNames.length >= 2 &&
      IT_JOB_TITLE.test(title) &&
      !NON_IT_TITLE.test(title) &&
      !(
        compiled.networkFocused &&
        SECURITY_ONLY_TITLE.test(title) &&
        !NETWORK_TITLE_HINT.test(title)
      );
    if (skillsBridge) {
      titleMatch = {
        ok: true,
        matched: [
          ...skillsMatchedNames.slice(0, 3),
          "skills-aligned role",
        ],
        familyIds: titleMatch.familyIds,
      };
    } else {
      reject = "title outside aspirant role family";
    }
  }

  if (!reject) {
    for (const sig of compiled.geoReject) {
      if (sig && blob.includes(sig)) {
        reject = `geo lock: ${sig}`;
        break;
      }
    }
  }

  const years = maxYearsRequiredFromText(blob);
  if (
    !reject &&
    years != null &&
    years > maxYearsCap &&
    !JUNIOR.test(title)
  ) {
    reject = `requires ${years}+ years (cap ${maxYearsCap})`;
  }

  const geoMatched = compiled.geoAllow.some((g) => g && blob.includes(g));

  let score = 0;
  if (titleMatch.ok) score += scoring.title_weight;
  score += Math.min(scoring.skills_weight, 5 * skillsMatchedNames.length);
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
    skills_matched: skillsMatchedNames.slice(0, 8),
    geo_matched: geoMatched,
    seniority_ok: seniorityOk,
    score,
    band: bandFor(score, titleStrong && titleMatch.ok),
  };

  scored.score = score;
  scored.match = match;

  if (
    !reject &&
    compiled.mustHaveSkillCount >= 3 &&
    matchSkillNames(descBlob, compiled.skillsList, compiled.skillMatchers)
      .length === 0 &&
    titleMatch.ok
  ) {
    reject = "missing must-have skills in posting";
  }

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

export type ScoreAllResult = {
  jobs: Job[];
  eligibleCount: number;
  dedupedCount: number;
};

/** Score every unique fingerprint — never drop by age. */
export function scoreAllJobs(jobs: Job[], profile: Profile): Job[] {
  return scoreAllJobsDetailed(jobs, profile).jobs;
}

export function scoreAllJobsDetailed(
  jobs: Job[],
  profile: Profile,
): ScoreAllResult {
  const ctx = compileScoreContext(profile);
  const seenUrl = new Set<string>();
  const seenFp = new Set<string>();
  const out: Job[] = [];
  let eligibleCount = 0;
  let dedupedCount = 0;

  for (const job of jobs) {
    if (!job.url || seenUrl.has(job.url)) {
      dedupedCount++;
      continue;
    }
    const fp = jobFingerprint(job);
    if (seenFp.has(fp)) {
      dedupedCount++;
      continue;
    }
    seenUrl.add(job.url);
    seenFp.add(fp);
    const scored = scoreJob(job, profile, ctx);
    if (scored.eligible) eligibleCount++;
    out.push(scored);
  }

  out.sort((a, b) => {
    if (!!b.eligible !== !!a.eligible) return a.eligible ? -1 : 1;
    const bandOrder = { A: 0, B: 1, C: 2 };
    const ba = bandOrder[a.match?.band || "C"];
    const bb = bandOrder[b.match?.band || "C"];
    if (ba !== bb) return ba - bb;
    return (b.score || 0) - (a.score || 0);
  });

  return { jobs: out, eligibleCount, dedupedCount };
}

/** Eligible-only view (for tests / optional server filter). */
export function filterEligible(jobs: Job[], profile: Profile): Job[] {
  return scoreAllJobs(jobs, profile).filter((j) => j.eligible);
}

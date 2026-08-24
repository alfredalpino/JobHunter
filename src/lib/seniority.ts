import { SENIORITY_CONFIG } from "./config";
import type { Profile } from "./types";

const LEVEL_ORDER = SENIORITY_CONFIG.levels;

export function levelRank(level: string): number {
  const idx = LEVEL_ORDER.indexOf(
    (level || "mid").toLowerCase() as (typeof LEVEL_ORDER)[number],
  );
  return idx >= 0 ? idx : LEVEL_ORDER.indexOf("mid");
}

export function detectTitleLevel(title: string): string {
  const titleL = (title || "").toLowerCase();
  const signals = SENIORITY_CONFIG.signals;
  let found = -1;
  let matched = "mid";

  for (const level of LEVEL_ORDER) {
    for (const sig of signals[level] || []) {
      const s = String(sig).toLowerCase().trim();
      if (!s) continue;
      let hit = false;
      if (s.length <= 3 || s.endsWith(".")) {
        const bare = s.replace(/\.$/, "");
        hit = new RegExp(`\\b${escapeReg(bare)}\\.?\\b`, "i").test(titleL);
      } else {
        hit = titleL.includes(s);
      }
      if (
        !hit &&
        ["vp", "sr", "jr", "cto", "cio", "ceo", "cfo", "coo"].includes(s)
      ) {
        hit = new RegExp(`\\b${escapeReg(s)}\\b`, "i").test(titleL);
      }
      if (hit) {
        const rank = levelRank(level);
        if (rank >= found) {
          found = rank;
          matched = level;
        }
      }
    }
  }
  return found >= 0 ? matched : "mid";
}

export function hasCredibility(profile: Profile): boolean {
  const cred = SENIORITY_CONFIG.credibility;
  const certs = profile.certifications || [];
  const skills = profile.skills_positive || [];
  const years = profile.experience?.estimated_years;
  const blob = (profile.raw_excerpt || "").toLowerCase();

  if (certs.length >= cred.min_certs) return true;
  if (years != null && years >= cred.min_years) return true;
  if (skills.length >= cred.min_skills) return true;
  for (const kw of cred.project_keywords) {
    if (blob.includes(kw.toLowerCase())) return true;
  }
  return Boolean(profile.experience?.credibility);
}

export function candidateMaxJobLevel(profile: Profile): string {
  const exp = profile.experience || ({} as Profile["experience"]);
  let level = String(exp.level || "junior_entry_associate");
  const band = String(exp.seniority_band || "").toLowerCase();

  if (LEVEL_ORDER.includes(band as (typeof LEVEL_ORDER)[number])) {
    if (band === "intern" || band === "junior") {
      level = "junior_entry_associate";
    } else if (band === "mid") {
      level = "mid_or_unknown";
    } else {
      level = band;
    }
  }

  let maxLevel =
    SENIORITY_CONFIG.max_job_level[level] || "junior";
  const credibility = Boolean(exp.credibility) || hasCredibility(profile);

  if (level === "junior_entry_associate" && credibility) {
    maxLevel = "mid";
  }

  if (LEVEL_ORDER.includes(band as (typeof LEVEL_ORDER)[number])) {
    if (band === "intern" || band === "junior") {
      maxLevel = credibility ? "mid" : "junior";
    } else {
      maxLevel = band;
    }
  }
  return maxLevel;
}

export function seniorityExcludesForProfile(profile: Profile): string[] {
  const maxLevel = candidateMaxJobLevel(profile);
  const maxRank = levelRank(maxLevel);
  const signals = SENIORITY_CONFIG.signals;
  const excludes: string[] = [];

  for (const level of LEVEL_ORDER) {
    if (levelRank(level) > maxRank) {
      excludes.push(...(signals[level] || []));
    }
  }

  const expLevel = String(profile.experience?.level || "");
  const band = String(profile.experience?.seniority_band || "").toLowerCase();
  if (
    expLevel === "junior_entry_associate" ||
    band === "intern" ||
    band === "junior"
  ) {
    for (const level of SENIORITY_CONFIG.junior_hard_block_levels) {
      excludes.push(
        ...(signals[level as keyof typeof signals] || []),
      );
    }
  }

  return uniq(excludes);
}

export function rejectForSeniority(
  title: string,
  profile: Profile,
): string | null {
  const jobLevel = detectTitleLevel(title);
  const maxLevel = candidateMaxJobLevel(profile);
  if (levelRank(jobLevel) > levelRank(maxLevel)) {
    return `seniority: ${jobLevel} role above your ${maxLevel} band`;
  }
  return null;
}

export function applySeniorityToProfile(profile: Profile): Profile {
  const exp = { ...profile.experience };
  const cred = hasCredibility({ ...profile, experience: exp });
  exp.credibility = cred;
  exp.max_job_level = candidateMaxJobLevel({ ...profile, experience: exp });

  const excludes = [
    ...(profile.exclude_title_signals || []),
    ...seniorityExcludesForProfile({ ...profile, experience: exp }),
  ];

  if (String(exp.level || "") === "junior_entry_associate") {
    if (cred) {
      exp.max_years_required = Math.max(exp.max_years_required || 3, 4);
      exp.target_band = exp.target_band || "0-4";
    } else {
      exp.max_years_required = Math.min(exp.max_years_required || 3, 3);
    }
  }

  return {
    ...profile,
    experience: exp,
    exclude_title_signals: uniq(excludes),
  };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = item.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

import { getRegion } from "./config";
import { sanitizeTargetTitles } from "./filters";
import { buildHuntQueries } from "./huntQueries";
import { mustMatchFromTitles } from "./roleFamilies";
import type { Profile } from "./types";

/** Parse comma / newline / semicolon title keywords for the portal search bar. */
export function parseTitleKeywords(raw: string): string[] {
  return sanitizeTargetTitles(
    raw
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean),
  ).slice(0, 8);
}

export type MinimalProfileInput = {
  titles: string[];
  name?: string;
  regionId?: string;
  locations?: string[];
};

/**
 * Lightweight profile so Hunt works without Analyze.
 * Source is `titles` — resume analyze replaces this when the user uploads later.
 */
export function buildMinimalProfileFromTitles(
  input: MinimalProfileInput,
): Profile {
  const titles = sanitizeTargetTitles(input.titles).slice(0, 8);
  if (!titles.length) {
    throw new Error("Enter at least one job title or keyword.");
  }

  const regionId = input.regionId || "dubai";
  const pack = getRegion(regionId);
  const locations =
    input.locations && input.locations.length > 0
      ? input.locations
      : pack
        ? [...pack.locations]
        : [];

  const profile: Profile = {
    source: "titles",
    candidate: {
      name: (input.name || "").trim() || "Aspirant",
      email: "",
      phone: "",
      linkedin: "",
      location: locations[0] || pack?.label || "",
    },
    experience: {
      estimated_years: null,
      max_years_required: 5,
      level: "mid_or_unknown",
      target_band: "0-5",
      credibility: false,
      max_job_level: "mid",
      seniority_band: "mid",
    },
    target_titles: titles,
    search_queries: [],
    skills_positive: [],
    certifications: [],
    title_must_match_any: mustMatchFromTitles(titles),
    plain_summary: `Title search: ${titles.join(", ")}`,
    raw_excerpt: titles.join(", "),
  };
  profile.search_queries = buildHuntQueries(profile).slice(0, 6);
  return profile;
}

/** Apply typed titles onto an existing profile and rebuild hunt queries. */
export function applyTitlesToProfile(
  profile: Profile,
  titles: string[],
): Profile {
  const nextTitles = sanitizeTargetTitles(titles).slice(0, 8);
  const next: Profile = {
    ...profile,
    target_titles: nextTitles,
    title_must_match_any: mustMatchFromTitles(nextTitles),
  };
  next.search_queries = buildHuntQueries(next).slice(0, 6);
  return next;
}

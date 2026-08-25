import { DEFAULT_RECENCY, DEFAULT_SCORING, getRegion } from "./config";
import { mustMatchFromTitles } from "./roleFamilies";
import { applySeniorityToProfile } from "./seniority";
import { expandSkills } from "./synonyms";
import type { DateWindowId, Preferences, Profile } from "./types";

/** Maps UI date windows → max age days for hunt. */
export const DATE_WINDOWS: {
  id: DateWindowId;
  label: string;
  maxDays: number;
  minDays: number;
}[] = [
  {
    id: "any_age",
    label: "Any age (show all scraped)",
    maxDays: 99999,
    minDays: 0,
  },
  { id: "this_week", label: "This week (0–7 days)", maxDays: 7, minDays: 0 },
  { id: "last_week", label: "Last week (8–14 days)", maxDays: 14, minDays: 8 },
  {
    id: "weeks_2_to_3",
    label: "2–3 weeks ago (15–21 days)",
    maxDays: 21,
    minDays: 15,
  },
  {
    id: "weeks_3_to_4",
    label: "3–4 weeks ago (22–30 days)",
    maxDays: 30,
    minDays: 22,
  },
  {
    id: "one_month",
    label: "Up to 1 month (0–30 days)",
    maxDays: 30,
    minDays: 0,
  },
  {
    id: "all_fresh",
    label: "Fresh ≤14 days (incl. unknown dates)",
    maxDays: 14,
    minDays: 0,
  },
];

export function maxDaysForWindow(id?: DateWindowId): number {
  const w = DATE_WINDOWS.find((d) => d.id === id);
  return w?.maxDays ?? 99999;
}

const BAND_TO_LEVEL: Record<string, string> = {
  intern: "junior_entry_associate",
  junior: "junior_entry_associate",
  mid: "mid_or_unknown",
  senior: "senior",
  lead: "lead",
  executive: "executive",
};

export function defaultPreferences(region = "dubai"): Preferences {
  const pack = getRegion(region);
  return {
    region,
    locations: pack?.locations ? [...pack.locations] : [],
    target_titles: [],
    must_have_skills: [],
    exclude_titles: [],
    seniority_band: "junior",
    work_auth: "",
    work_mode: "any",
    country_indeed: pack?.country_indeed || "",
    recency_max_days: 14,
    date_window: "all_fresh",
  };
}

export function applyPreferencesToProfile(
  profile: Profile,
  prefs: Preferences,
): Profile {
  const region = getRegion(prefs.region);
  const locations =
    prefs.locations?.length > 0
      ? prefs.locations
      : region?.locations || [];

  let allow = [...(region?.allow_signals || [])];
  let reject = [...(region?.reject_signals || [])];
  const workMode = (prefs.work_mode || "any").toLowerCase();

  if (workMode === "remote") {
    for (const sig of ["remote", "worldwide", "work from home", "wfh"]) {
      if (!allow.includes(sig)) allow.push(sig);
    }
  }
  if (workMode === "hybrid") {
    for (const sig of ["hybrid", "remote", "flexible"]) {
      if (!allow.includes(sig)) allow.push(sig);
    }
    reject = uniq([...reject, "fully remote only", "remote-only", "100% remote"]);
  }
  if (workMode === "onsite") {
    reject = uniq([
      ...reject,
      "fully remote only",
      "remote-only",
      "100% remote",
    ]);
  }

  const workAuth = (prefs.work_auth || profile.candidate.work_auth || "")
    .toLowerCase()
    .trim();
  if (workAuth.includes("sponsor")) {
    for (const sig of ["visa", "sponsor", "sponsorship", "relocation"]) {
      if (!allow.includes(sig)) allow.push(sig);
    }
  }
  if (workAuth.includes("authorized") || workAuth.includes("citizen")) {
    for (const sig of ["eligible to work", "authorized", "no sponsorship"]) {
      if (!allow.includes(sig)) allow.push(sig);
    }
  }

  const merged: Profile = {
    ...profile,
    scoring: { ...DEFAULT_SCORING, ...(profile.scoring || {}) },
    recency: {
      ...DEFAULT_RECENCY,
      max_age_days: prefs.recency_max_days || 14,
      ...(profile.recency || {}),
    },
    geo: {
      region: prefs.region,
      default_locations: locations,
      allow_signals: allow,
      reject_signals: reject,
      country_indeed: prefs.country_indeed || region?.country_indeed || "",
      work_mode: workMode,
    },
    candidate: {
      ...profile.candidate,
      work_auth: prefs.work_auth || profile.candidate.work_auth,
      location:
        locations.length > 0
          ? `${region?.label || locations.slice(0, 2).join(", ")} (target)`
          : profile.candidate.location,
    },
  };

  if (prefs.target_titles?.length) {
    merged.target_titles = uniq([
      ...prefs.target_titles,
      ...profile.target_titles,
    ]);
    merged.search_queries = prefs.target_titles.slice(0, 4);
    // Phrase-level must-match only — no token soup from titles
    merged.title_must_match_any = uniq([
      ...mustMatchFromTitles(merged.target_titles),
      ...(profile.title_must_match_any || []).filter(
        (s) => s.includes(" ") || s.length > 5,
      ),
    ]);
  }

  if (prefs.date_window) {
    const maxDays = Math.max(
      prefs.recency_max_days || 14,
      maxDaysForWindow(prefs.date_window),
    );
    merged.recency = {
      ...merged.recency,
      max_age_days: maxDays,
    };
  }

  if (prefs.must_have_skills?.length) {
    merged.skills_positive = expandSkills(
      uniq([...(profile.skills_positive || []), ...prefs.must_have_skills]),
    );
  } else {
    merged.skills_positive = expandSkills(profile.skills_positive || []);
  }

  if (prefs.exclude_titles?.length) {
    merged.exclude_title_signals = uniq([
      ...(profile.exclude_title_signals || []),
      ...prefs.exclude_titles,
    ]);
  }

  const band = (prefs.seniority_band || "").toLowerCase().trim();
  if (band) {
    const level = BAND_TO_LEVEL[band] || "junior_entry_associate";
    const maxLevel =
      band === "intern" || band === "junior"
        ? "junior"
        : band === "mid"
          ? "mid"
          : band;
    merged.experience = {
      ...merged.experience,
      seniority_band: band,
      level,
      max_job_level: maxLevel,
    };
  }

  return applySeniorityToProfile(merged);
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = String(item).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(item).trim());
  }
  return out;
}

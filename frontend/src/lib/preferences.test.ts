import { describe, expect, it } from "vitest";
import {
  applyPreferencesToProfile,
  defaultPreferences,
  maxDaysForWindow,
} from "./preferences";
import type { Profile } from "./types";

describe("maxDaysForWindow", () => {
  it("maps known windows", () => {
    expect(maxDaysForWindow("this_week")).toBe(7);
    expect(maxDaysForWindow("all_fresh")).toBe(14);
    expect(maxDaysForWindow("any_age")).toBe(99999);
  });
});

describe("defaultPreferences", () => {
  it("seeds dubai region pack", () => {
    const prefs = defaultPreferences("dubai");
    expect(prefs.region).toBe("dubai");
    expect(prefs.date_window).toBe("any_age");
  });
});

describe("applyPreferencesToProfile", () => {
  it("applies titles and skills onto profile", () => {
    const profile = {
      source: "test",
      candidate: {
        name: "A",
        email: "",
        phone: "",
        linkedin: "",
        location: "",
      },
      experience: {
        estimated_years: 2,
        max_years_required: 3,
        level: "junior_entry_associate",
        target_band: "0-3",
        credibility: true,
        max_job_level: "mid",
      },
      target_titles: ["Old"],
      search_queries: [],
      skills_positive: ["network"],
      certifications: [],
      title_must_match_any: [],
      exclude_title_signals: [],
      raw_excerpt: "",
      scoring: {
        min_score_to_keep: 35,
        title_weight: 30,
        skills_weight: 25,
        junior_boost: 15,
        mid_boost: 10,
        geo_boost: 20,
      },
      recency: {
        max_age_days: 14,
        reject_unknown_date: true,
        bucket_week_1_days: 7,
      },
      geo: { allow_signals: [], reject_signals: [] },
    } as Profile;

    const prefs = defaultPreferences("dubai");
    prefs.target_titles = ["NOC Engineer"];
    prefs.must_have_skills = ["cisco"];
    prefs.date_window = "this_week";
    prefs.recency_max_days = 7;

    const merged = applyPreferencesToProfile(profile, prefs);
    expect(merged.target_titles).toContain("NOC Engineer");
    expect(merged.skills_positive.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["cisco"]),
    );
    expect(merged.recency?.max_age_days).toBe(7);
    expect(merged.geo?.region).toBe("dubai");
  });
});

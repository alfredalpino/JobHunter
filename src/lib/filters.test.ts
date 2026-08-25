import { describe, expect, it } from "vitest";
import { applyJobFilters, jobMatchesWorkModeFilter, mergeProfileIntoPrefs, splitKeywordListInput } from "./filters";
import { defaultPreferences } from "./preferences";
import { analyzeResumeText } from "./resume";
import type { Profile } from "./types";

describe("mergeProfileIntoPrefs", () => {
  it("seeds region from resume location and seniority excludes for junior", () => {
    const profile = analyzeResumeText(
      "Sam Ali\nBangalore India\nJunior Network Engineer\nCCNA Cisco",
    );
    const merged = mergeProfileIntoPrefs(profile, defaultPreferences("dubai"));
    expect(merged.region).toBe("bangalore");
    expect(merged.seniority_band).toBe("junior");
    expect(merged.must_have_skills.length).toBeGreaterThan(0);
    expect(merged.exclude_titles.map((e) => e.toLowerCase())).toContain(
      "senior",
    );
  });

  it("preserves user region when not default dubai", () => {
    const profile = {
      source: "test",
      candidate: {
        name: "A",
        email: "",
        phone: "",
        linkedin: "",
        location: "Dubai",
      },
      experience: {
        estimated_years: 2,
        max_years_required: 3,
        level: "junior_entry_associate",
        target_band: "0-3",
        credibility: false,
        max_job_level: "mid",
      },
      target_titles: ["Analyst"],
      search_queries: ["Analyst"],
      skills_positive: ["excel"],
      certifications: [],
      title_must_match_any: [],
      raw_excerpt: "",
    } as Profile;

    const merged = mergeProfileIntoPrefs(
      profile,
      defaultPreferences("usa"),
    );
    expect(merged.region).toBe("usa");
  });
});

describe("splitKeywordListInput", () => {
  it("keeps single-character tokens while typing", () => {
    expect(splitKeywordListInput("s")).toEqual(["s"]);
    expect(splitKeywordListInput("senior, m")).toEqual(["senior", "m"]);
  });

  it("dedupes and trims exclude keywords", () => {
    expect(splitKeywordListInput(" senior , Manager ; senior ")).toEqual([
      "senior",
      "Manager",
    ]);
  });
});

describe("jobMatchesWorkModeFilter", () => {
  it("filters remote and onsite listings", () => {
    const remoteJob = {
      title: "NOC Engineer",
      company: "X",
      url: "https://a.test/r",
      portal: "t",
      location: "Remote",
      summary: "work from home worldwide",
      posted_at: "",
    };
    const onsiteJob = {
      title: "Network Engineer",
      company: "Y",
      url: "https://a.test/o",
      portal: "t",
      location: "Lucknow, India",
      summary: "on-site role in office",
      posted_at: "",
    };
    const hybridJob = {
      title: "IT Support",
      company: "Z",
      url: "https://a.test/h",
      portal: "t",
      location: "Bangalore",
      summary: "hybrid schedule 3 days office",
      posted_at: "",
    };

    expect(jobMatchesWorkModeFilter(remoteJob, "remote")).toBe(true);
    expect(jobMatchesWorkModeFilter(onsiteJob, "remote")).toBe(false);
    expect(jobMatchesWorkModeFilter(hybridJob, "hybrid")).toBe(true);
    expect(jobMatchesWorkModeFilter(onsiteJob, "onsite")).toBe(true);
    expect(jobMatchesWorkModeFilter(remoteJob, "onsite")).toBe(false);
  });
});

describe("applyJobFilters", () => {
  it("filters eligible + date window in one pass", () => {
    const jobs = [
      {
        title: "A",
        company: "X",
        url: "https://a.test/1",
        portal: "t",
        location: "",
        summary: "",
        posted_at: "2026-08-20",
        eligible: true,
        posted_age_days: 5,
        recency_bucket: "last_7_days" as const,
        match: {
          band: "A" as const,
          title_matched: [],
          skills_matched: [],
          geo_matched: false,
          seniority_ok: true,
          score: 70,
        },
      },
      {
        title: "B",
        company: "Y",
        url: "https://a.test/2",
        portal: "t",
        location: "",
        summary: "",
        posted_at: "2026-08-01",
        eligible: true,
        posted_age_days: 24,
        recency_bucket: "days_22_to_30" as const,
        match: {
          band: "B" as const,
          title_matched: [],
          skills_matched: [],
          geo_matched: false,
          seniority_ok: true,
          score: 55,
        },
      },
    ];
    const out = applyJobFilters(jobs, {
      fitFilter: "eligible",
      dateFilter: "all_fresh",
      showBandC: true,
      statusFilter: "all",
      applied: {},
    });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("A");
  });
});

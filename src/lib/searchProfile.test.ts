import { describe, expect, it } from "vitest";
import {
  applyTitlesToProfile,
  buildMinimalProfileFromTitles,
  parseTitleKeywords,
} from "./searchProfile";
import type { Profile } from "./types";

describe("parseTitleKeywords", () => {
  it("splits commas and newlines into clean titles", () => {
    expect(
      parseTitleKeywords("Network Engineer, NOC Engineer\nIT Support"),
    ).toEqual(["Network Engineer", "NOC Engineer", "IT Support"]);
  });

  it("dedupes case-insensitively and drops junk phrases", () => {
    const out = parseTitleKeywords(
      "network engineer; Network Engineer; responsible for routing",
    );
    expect(out.map((t) => t.toLowerCase())).toEqual(["network engineer"]);
  });

  it("returns empty for blank input", () => {
    expect(parseTitleKeywords("  , \n ")).toEqual([]);
  });
});

describe("buildMinimalProfileFromTitles", () => {
  it("builds a titles-source profile with hunt queries", () => {
    const p = buildMinimalProfileFromTitles({
      titles: ["Network Engineer", "NOC Engineer"],
      name: "Sam",
      regionId: "dubai",
    });
    expect(p.source).toBe("titles");
    expect(p.candidate.name).toBe("Sam");
    expect(p.target_titles).toEqual(["Network Engineer", "NOC Engineer"]);
    expect(p.search_queries.length).toBeGreaterThan(0);
    expect(p.search_queries[0].toLowerCase()).toContain("network");
    expect(p.experience.max_job_level).toBe("mid");
  });

  it("throws when no usable titles", () => {
    expect(() => buildMinimalProfileFromTitles({ titles: [] })).toThrow(
      /job title/i,
    );
  });
});

describe("applyTitlesToProfile", () => {
  it("rebuilds search_queries from new titles", () => {
    const base = buildMinimalProfileFromTitles({
      titles: ["Analyst"],
      regionId: "dubai",
    });
    const next = applyTitlesToProfile(base, ["Software Engineer"]);
    expect(next.target_titles).toEqual(["Software Engineer"]);
    expect(next.search_queries.some((q) => /software|developer/i.test(q))).toBe(
      true,
    );
  });

  it("preserves non-title fields", () => {
    const base = {
      source: "resume",
      candidate: {
        name: "A",
        email: "a@b.c",
        phone: "",
        linkedin: "",
        location: "Dubai",
      },
      experience: {
        estimated_years: 2,
        max_years_required: 3,
        level: "junior_entry_associate",
        target_band: "0-3",
        credibility: true,
        max_job_level: "junior",
      },
      target_titles: ["Old"],
      search_queries: ["Old"],
      skills_positive: ["cisco"],
      certifications: ["CCNA"],
      title_must_match_any: ["old"],
      raw_excerpt: "resume text",
    } as Profile;
    const next = applyTitlesToProfile(base, ["NOC Engineer"]);
    expect(next.candidate.email).toBe("a@b.c");
    expect(next.skills_positive).toEqual(["cisco"]);
    expect(next.certifications).toEqual(["CCNA"]);
    expect(next.source).toBe("resume");
  });
});

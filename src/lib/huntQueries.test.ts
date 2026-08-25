import { describe, expect, it } from "vitest";
import { buildHuntQueries, inferExtraFamilies } from "./huntQueries";
import type { Profile } from "./types";

const baseProfile = (): Profile => ({
  source: "resume",
  candidate: {
    name: "Test",
    email: "",
    phone: "",
    linkedin: "",
    location: "",
  },
  experience: {
    estimated_years: 4,
    max_years_required: 3,
    level: "mid",
    target_band: "0-3",
    credibility: true,
    max_job_level: "mid",
  },
  target_titles: ["Research Analyst"],
  search_queries: ["Research Analyst"],
  skills_positive: ["python", "sql", "tableau"],
  certifications: [],
  title_must_match_any: ["research analyst"],
  raw_excerpt: "",
});

describe("buildHuntQueries", () => {
  it("expands data analyst profile with family queries", () => {
    const q = buildHuntQueries(baseProfile());
    expect(q.map((x) => x.toLowerCase())).toEqual(
      expect.arrayContaining([
        "research analyst",
        "data analyst",
        "business analyst",
      ]),
    );
  });

  it("adds network queries when CCNA skills present", () => {
    const p = baseProfile();
    p.skills_positive = ["cisco", "routing", "switching", "python"];
    p.certifications = ["CCNA"];
    const q = buildHuntQueries(p);
    expect(q.map((x) => x.toLowerCase())).toEqual(
      expect.arrayContaining([
        "network engineer",
        "noc engineer",
        "junior network engineer",
        "field technician",
      ]),
    );
    expect(inferExtraFamilies(p)).toContain("network_ops");
  });
});

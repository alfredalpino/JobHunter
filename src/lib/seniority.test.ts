import { describe, expect, it } from "vitest";
import {
  applySeniorityToProfile,
  detectTitleLevel,
  levelRank,
  rejectForSeniority,
  stripTitleTierSuffix,
} from "./seniority";
import type { Profile } from "./types";

describe("detectTitleLevel", () => {
  it("detects senior and junior titles", () => {
    expect(detectTitleLevel("Senior Network Engineer")).toMatch(/senior/);
    expect(levelRank(detectTitleLevel("Senior Network Engineer"))).toBeGreaterThan(
      levelRank(detectTitleLevel("Junior Network Engineer")),
    );
  });

  it("defaults mid for unmarked titles", () => {
    expect(detectTitleLevel("Network Engineer")).toBe("mid");
  });

  it("does not treat Roman tier suffix as seniority", () => {
    expect(detectTitleLevel("Field Technician III")).toBe("mid");
    expect(detectTitleLevel("Application Security Engineer II")).toBe("mid");
    expect(stripTitleTierSuffix("Network Engineer II")).toBe("Network Engineer");
  });
});

describe("rejectForSeniority", () => {
  const juniorProfile = {
    experience: {
      estimated_years: 2,
      max_years_required: 3,
      level: "junior_entry_associate",
      target_band: "0-3",
      credibility: true,
      max_job_level: "mid",
    },
  } as Profile;

  it("rejects director titles for junior-capped profiles", () => {
    const reason = rejectForSeniority("Director of Engineering", juniorProfile);
    expect(reason).toBeTruthy();
  });

  it("allows mid titles within cap", () => {
    expect(rejectForSeniority("Network Engineer", juniorProfile)).toBeFalsy();
  });

  it("does not inflate junior year cap to 4+ when credibility is set", () => {
    const next = applySeniorityToProfile({
      ...juniorProfile,
      experience: {
        ...juniorProfile.experience!,
        max_years_required: 2,
        credibility: true,
        level: "junior_entry_associate",
      },
      certifications: ["CCNA"],
      skills_positive: ["cisco", "routing", "switching", "vlan", "ospf"],
      raw_excerpt: "built lab portfolio on github",
    } as Profile);
    expect(next.experience.max_years_required).toBeLessThanOrEqual(3);
    expect(next.experience.max_years_required).toBe(2);
  });
});

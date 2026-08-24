import { describe, expect, it } from "vitest";
import {
  detectTitleLevel,
  levelRank,
  rejectForSeniority,
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
});

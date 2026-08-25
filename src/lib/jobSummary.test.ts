import { describe, expect, it } from "vitest";
import { clipJobSummary } from "./jobSummary";
import { maxYearsRequiredFromText } from "./eligibility";

describe("clipJobSummary", () => {
  it("preserves late qualifications year requirements when truncating", () => {
    const duties = ("Perform daily HFC maintenance. ".repeat(80)).trim();
    const quals =
      "Qualifications: Up to a minimum of 5 years' experience in the cable industry with knowledge of Outside Plant.";
    const raw = `${duties} ${quals}`;
    expect(raw.length).toBeGreaterThan(1800);
    const summary = clipJobSummary(raw, 1800);
    expect(maxYearsRequiredFromText(summary)).toBe(5);
    expect(summary.toLowerCase()).toMatch(/5 years/);
  });
});

import { describe, expect, it } from "vitest";
import { parsePostedAgeDays, annotateRecency } from "./recency";
import type { Job } from "./types";

describe("parsePostedAgeDays", () => {
  const today = new Date(Date.UTC(2026, 7, 25)); // 2026-08-25

  it("parses ISO dates", () => {
    const r = parsePostedAgeDays("2026-08-20", today);
    expect(r.age).toBe(5);
  });

  it("parses relative days", () => {
    expect(parsePostedAgeDays("3 days ago", today).age).toBe(3);
    expect(parsePostedAgeDays("today", today).age).toBe(0);
  });

  it("returns null for unknown text", () => {
    expect(parsePostedAgeDays("sometime recently", today).age).toBeNull();
  });
});

describe("annotateRecency", () => {
  it("sets last_7_days bucket for fresh jobs", () => {
    const job: Job = {
      title: "Engineer",
      company: "Acme",
      url: "https://example.com/1",
      portal: "test",
      location: "Dubai",
      summary: "",
      posted_at: "2 days ago",
    };
    annotateRecency(job);
    expect(job.posted_age_days).toBe(2);
    expect(job.recency_bucket).toBe("last_7_days");
  });
});

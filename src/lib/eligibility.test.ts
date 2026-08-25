import { describe, expect, it } from "vitest";
import {
  maxYearsRequiredFromText,
  scoreJob,
  scoreAllJobs,
} from "./eligibility";
import { matchTitleToProfile } from "./roleFamilies";
import type { Job, Profile } from "./types";

function baseProfile(over: Partial<Profile> = {}): Profile {
  return {
    source: "test",
    candidate: {
      name: "Test",
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
      credibility: true,
      max_job_level: "mid",
    },
    target_titles: ["Network Engineer", "NOC Engineer"],
    search_queries: ["Network Engineer"],
    skills_positive: ["network", "cisco", "ccna"],
    certifications: ["CCNA"],
    title_must_match_any: ["Network Engineer", "NOC Engineer"],
    exclude_title_signals: ["senior", "director", "marketing"],
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
    geo: {
      allow_signals: ["dubai", "remote", "uae"],
      reject_signals: ["us citizen"],
    },
    ...over,
  };
}

function job(partial: Partial<Job>): Job {
  return {
    title: "Network Engineer",
    company: "Acme",
    url: "https://example.com/job/1",
    portal: "test",
    location: "Dubai / Remote",
    summary: "Cisco CCNA routing switching",
    posted_at: new Date().toISOString().slice(0, 10),
    ...partial,
  };
}

describe("role family matching", () => {
  it("rejects marketing for network profile", () => {
    const m = matchTitleToProfile("Digital Marketing Intern", {
      target_titles: ["Network Engineer"],
      title_must_match_any: ["Network Engineer"],
    });
    expect(m.ok).toBe(false);
  });

  it("rejects weak Network Partnership", () => {
    const m = matchTitleToProfile("Affiliate EAP Counsellor (Network Partnership)", {
      target_titles: ["Network Engineer"],
      title_must_match_any: ["Network Engineer", "NOC Engineer"],
    });
    expect(m.ok).toBe(false);
  });

  it("accepts junior network engineer", () => {
    const m = matchTitleToProfile("Junior Network Engineer", {
      target_titles: ["Network Engineer"],
      title_must_match_any: ["Network Engineer"],
    });
    expect(m.ok).toBe(true);
  });
});

describe("eligibility", () => {
  it("rejects marketing jobs", () => {
    const scored = scoreJob(
      job({
        title: "Digital Marketing Intern",
        url: "https://example.com/mkt",
        summary: "campaigns social media",
      }),
      baseProfile(),
    );
    expect(scored.eligible).toBe(false);
  });

  it("rejects senior for junior profile", () => {
    const scored = scoreJob(
      job({
        title: "Senior Network Engineer",
        url: "https://example.com/senior",
      }),
      baseProfile(),
    );
    expect(scored.eligible).toBe(false);
  });

  it("annotates unknown posting dates without dropping from scoreAllJobs", () => {
    const scored = scoreJob(
      job({ title: "Network Engineer", posted_at: "", summary: "cisco" }),
      baseProfile(),
    );
    expect(scored.recency_bucket).toBe("unknown");
    // May still be eligible on title/skills — age no longer hard-rejects
    expect(scored.reject_reason || "").not.toMatch(/no posting date/i);
  });

  it("accepts fresh junior network role with match reasons", () => {
    const scored = scoreJob(
      job({
        title: "Junior Network Engineer",
        summary: "Cisco CCNA routing Dubai remote",
      }),
      baseProfile(),
    );
    expect(scored.eligible).toBe(true);
    expect(scored.match?.title_matched.length).toBeGreaterThan(0);
    expect(["A", "B", "C"]).toContain(scored.match?.band);
  });

  it("scoreAllJobs keeps mismatched titles in the pool", () => {
    const jobs = [
      job({
        title: "NOC Engineer",
        url: "https://example.com/a",
        summary: "cisco network dubai",
      }),
      job({
        title: "Digital Marketing Intern",
        url: "https://example.com/b",
        summary: "campaigns",
      }),
    ];
    const all = scoreAllJobs(jobs, baseProfile());
    expect(all.length).toBe(2);
    expect(all.some((j) => j.eligible && /noc/i.test(j.title))).toBe(true);
    expect(
      all.find((j) => /marketing/i.test(j.title))?.eligible,
    ).toBe(false);
  });

  it("rejects title match with no skill overlap when profile has many must-haves", () => {
    const scored = scoreJob(
      job({
        title: "Network Engineer",
        summary: "general IT role dubai",
      }),
      baseProfile({
        skills_positive: [
          "network",
          "cisco",
          "ccna",
          "routing",
          "switching",
          "firewall",
        ],
      }),
    );
    expect(scored.eligible).toBe(false);
    expect(scored.reject_reason).toMatch(/must-have skills/i);
  });

  it("rejects spam listings", () => {
    const scored = scoreJob(
      job({ title: "Earn $5000 weekly work from phone" }),
      baseProfile(),
    );
    expect(scored.eligible).toBe(false);
    expect(scored.reject_reason).toMatch(/spam/i);
  });

  it("accepts field technician for network profile", () => {
    const scored = scoreJob(
      job({
        title: "Field Technician III",
        url: "https://example.com/field",
        summary: "HFC coaxial network maintenance troubleshooting",
      }),
      baseProfile(),
    );
    expect(scored.eligible).toBe(true);
  });

  it("rejects application security engineer for network-focused profile", () => {
    const scored = scoreJob(
      job({
        title: "Application Security Engineer II",
        url: "https://example.com/appsec",
        summary: "AWS security cisco routing",
      }),
      baseProfile({
        target_titles: ["Network Engineer", "NOC Engineer"],
        skills_positive: ["network", "cisco", "ccna", "routing", "switching"],
      }),
    );
    expect(scored.eligible).toBe(false);
    expect(scored.reject_reason).toMatch(/role family/i);
  });

  it("rejects Cable Bahamas-style 5 years' experience for junior cap", () => {
    const summary =
      "Up to a minimum of 5 years' experience in the cable industry with knowledge of Outside Plant (inclusive of but not limited to, Installation, Service, Construction, Preventative Maintenance and fibre network topology. Minimum of an Associate Degree or Certification in Construction, HFC or Fiber.";
    const scored = scoreJob(
      job({
        title: "Field Technician III",
        company: "Cable Bahamas",
        url: "https://example.com/cable-bahamas",
        summary,
      }),
      baseProfile({
        experience: {
          estimated_years: 1,
          max_years_required: 2,
          level: "junior_entry_associate",
          target_band: "0-2",
          credibility: true,
          max_job_level: "junior",
        },
      }),
    );
    expect(scored.eligible).toBe(false);
    expect(scored.reject_reason).toMatch(/5\+ years/i);
  });
});

describe("maxYearsRequiredFromText", () => {
  it("parses possessive years' and minimum-of phrasing", () => {
    expect(
      maxYearsRequiredFromText(
        "Up to a minimum of 5 years' experience in the cable industry",
      ),
    ).toBe(5);
    expect(
      maxYearsRequiredFromText("5 years’ experience with HFC"),
    ).toBe(5);
    expect(maxYearsRequiredFromText("minimum of 3 years in networking")).toBe(
      3,
    );
    expect(maxYearsRequiredFromText("at least 2 years of experience")).toBe(2);
    expect(maxYearsRequiredFromText("5+ years experience")).toBe(5);
  });
});

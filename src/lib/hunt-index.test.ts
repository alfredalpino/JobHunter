import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Job, Profile } from "./types";

/**
 * Hunt prefers index when queryJobsFromIndex reports available jobs.
 * We mock the index module and sources to avoid network.
 */
describe("hunt prefers index", () => {
  const prevDb = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/index/queryJobs");
    vi.doUnmock("@/lib/sources");
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it("uses index jobs when available", async () => {
    const indexJobs: Job[] = [
      {
        title: "Network Engineer",
        company: "Acme",
        url: "https://example.com/index-job",
        portal: "remoteok",
        location: "Remote",
        summary: "Cisco CCNA routing switching",
        posted_at: "2026-08-20",
        source_method: "shared_index",
      },
    ];

    vi.doMock("@/lib/index/queryJobs", () => ({
      queryJobsFromIndex: vi.fn(async () => ({
        jobs: indexJobs,
        indexCount: 1,
        available: true,
      })),
      countIndexJobs: vi.fn(async () => 1),
    }));

    const liveSpy = vi.fn(async () => ({
      jobs: [
        {
          title: "Should not use",
          company: "X",
          url: "https://example.com/live",
          portal: "remotive",
          location: "Remote",
          summary: "x",
          posted_at: "2026-08-20",
        },
      ],
      sources: [],
    }));
    vi.doMock("@/lib/sources", () => ({
      fetchJobsForProfile: liveSpy,
    }));

    const { POST } = await import("@/app/api/hunt/route");
    const profile: Profile = {
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
      target_titles: ["Network Engineer"],
      search_queries: ["Network Engineer"],
      skills_positive: ["network", "cisco", "ccna"],
      certifications: [],
      title_must_match_any: ["Network Engineer"],
      exclude_title_signals: [],
      raw_excerpt: "",
      geo: { region: "dubai", allow_signals: ["dubai", "remote"] },
    };

    const res = await POST(
      new Request("http://localhost/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, preferences: { region: "dubai" } }),
      }),
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.source).toBe("index");
    expect(data.index_count).toBe(1);
    expect(liveSpy).not.toHaveBeenCalled();
    expect(data.jobs.some((j: Job) => j.url.includes("index-job"))).toBe(true);
  });

  it("falls back to live scrape when index empty", async () => {
    vi.doMock("@/lib/index/queryJobs", () => ({
      queryJobsFromIndex: vi.fn(async () => ({
        jobs: [],
        indexCount: 0,
        available: false,
      })),
      countIndexJobs: vi.fn(async () => 0),
    }));

    vi.doMock("@/lib/sources", () => ({
      fetchJobsForProfile: vi.fn(async () => ({
        jobs: [
          {
            title: "Network Engineer",
            company: "LiveCo",
            url: "https://example.com/live-job",
            portal: "remotive",
            location: "Remote",
            summary: "Cisco CCNA",
            posted_at: "2026-08-20",
          },
        ],
        sources: [
          { id: "remotive", name: "Remotive", ok: true, count: 1 },
        ],
      })),
    }));

    const { POST } = await import("@/app/api/hunt/route");
    const profile: Profile = {
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
      target_titles: ["Network Engineer"],
      search_queries: ["Network Engineer"],
      skills_positive: ["network", "cisco"],
      certifications: [],
      title_must_match_any: ["Network Engineer"],
      exclude_title_signals: [],
      raw_excerpt: "",
      geo: { region: "dubai", allow_signals: ["dubai", "remote"] },
    };

    const res = await POST(
      new Request("http://localhost/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      }),
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.source).toBe("live_scrape");
    expect(data.jobs.some((j: Job) => j.url.includes("live-job"))).toBe(true);
  });
});

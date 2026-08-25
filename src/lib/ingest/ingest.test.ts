import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildIngestSeeds } from "./seeds";
import { authorizeCron } from "./auth";

describe("buildIngestSeeds", () => {
  it("caps seed count", () => {
    const seeds = buildIngestSeeds({ maxSeeds: 6 });
    expect(seeds.length).toBeLessThanOrEqual(6);
    expect(seeds[0]).toMatchObject({
      familyId: expect.any(String),
      query: expect.any(String),
      regionId: expect.any(String),
    });
  });

  it("respects region filter", () => {
    const seeds = buildIngestSeeds({
      maxSeeds: 20,
      regionIds: ["remote", "dubai"],
    });
    expect(seeds.every((s) => s.regionId === "remote" || s.regionId === "dubai")).toBe(
      true,
    );
  });
});

describe("authorizeCron", () => {
  const prev = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("accepts Bearer token", () => {
    const req = new Request("http://localhost/api/cron/ingest", {
      headers: { Authorization: "Bearer test-secret" },
    });
    expect(authorizeCron(req)).toBe(true);
  });

  it("rejects missing secret", () => {
    const req = new Request("http://localhost/api/cron/ingest");
    expect(authorizeCron(req)).toBe(false);
  });

  it("fails closed when CRON_SECRET unset", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost/api/cron/ingest", {
      headers: { Authorization: "Bearer test-secret" },
    });
    expect(authorizeCron(req)).toBe(false);
  });
});

describe("ingest skip without DATABASE_URL", () => {
  it("runIngest returns skipped when no DB", async () => {
    vi.resetModules();
    const prevDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { resetDbCache } = await import("@/lib/db/client");
    resetDbCache();
    const { runIngest } = await import("./runIngest");
    const result = await runIngest({ maxSeeds: 1 });
    expect(result.skipped).toBe(true);
    expect(result.ok).toBe(false);
    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    resetDbCache();
  });
});

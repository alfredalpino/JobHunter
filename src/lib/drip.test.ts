import { describe, expect, it } from "vitest";
import {
  DRIP_BATCH,
  advanceDripCursor,
  dripBatch,
  dripEligibleQueue,
} from "./drip";
import type { AppliedRecord, Job } from "./types";

function job(n: number): Job {
  return {
    title: `Role ${n}`,
    company: "Co",
    url: `https://example.com/j/${n}`,
    portal: "test",
    location: "Remote",
    summary: "x",
    posted_at: "2026-08-01",
    eligible: true,
  };
}

describe("drip cursor", () => {
  it("returns first batch of 10", () => {
    const queue = Array.from({ length: 25 }, (_, i) => job(i));
    const { batch, nextCursor, remaining, total } = dripBatch(queue, 0);
    expect(batch).toHaveLength(DRIP_BATCH);
    expect(batch[0].url).toContain("/0");
    expect(nextCursor).toBe(10);
    expect(remaining).toBe(15);
    expect(total).toBe(25);
  });

  it("advances to next 10", () => {
    const queue = Array.from({ length: 25 }, (_, i) => job(i));
    const cursor = advanceDripCursor(0, queue.length);
    const { batch, remaining } = dripBatch(queue, cursor);
    expect(cursor).toBe(10);
    expect(batch[0].url).toContain("/10");
    expect(remaining).toBe(5);
  });

  it("excludes applied/skipped from eligible queue", () => {
    const jobs = [job(1), job(2), job(3)];
    const map: Record<string, AppliedRecord> = {
      [jobs[0].url]: { status: "applied", updatedAt: "2026-08-25" },
      [jobs[1].url]: { status: "skipped", updatedAt: "2026-08-25" },
    };
    const queue = dripEligibleQueue(jobs, map);
    expect(queue).toHaveLength(1);
    expect(queue[0].url).toBe(jobs[2].url);
  });
});

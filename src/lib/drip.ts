import type { AppliedRecord, Job, JobStatus } from "@/lib/types";
import { getJobStatus } from "@/lib/applied";

export const DRIP_BATCH = 10;

const BLOCKED: JobStatus[] = ["applied", "skipped", "ghosted"];

/** Eligible queue order after filters — excludes acted-on URLs. */
export function dripEligibleQueue(
  jobs: Job[],
  map: Record<string, AppliedRecord>,
): Job[] {
  const blocked = new Set(BLOCKED);
  return jobs.filter((j) => j.url && !blocked.has(getJobStatus(j.url, map)));
}

/**
 * Top-10 drip window from a ranked queue.
 * `cursor` is how many already revealed (multiples of batch after each unlock).
 */
export function dripBatch(
  queue: Job[],
  cursor: number,
  batchSize = DRIP_BATCH,
): { batch: Job[]; nextCursor: number; remaining: number; total: number } {
  const start = Math.max(0, cursor);
  const batch = queue.slice(start, start + batchSize);
  const nextCursor = start + batch.length;
  return {
    batch,
    nextCursor,
    remaining: Math.max(0, queue.length - nextCursor),
    total: queue.length,
  };
}

/** Advance cursor by one batch (unlock next 10). */
export function advanceDripCursor(
  cursor: number,
  queueLength: number,
  batchSize = DRIP_BATCH,
): number {
  if (queueLength <= 0) return 0;
  const next = cursor + batchSize;
  return Math.min(next, queueLength);
}

/**
 * After marking a job applied/skipped, keep showing current batch size
 * by sliding window — prefer advancing when current window is emptied.
 */
export function reconcileDripAfterAction(
  queue: Job[],
  cursor: number,
  batchSize = DRIP_BATCH,
): number {
  const { batch, nextCursor } = dripBatch(queue, Math.max(0, cursor - batchSize), batchSize);
  // If previous window start still has items, stay; else snap to filled window
  if (batch.length >= Math.min(batchSize, queue.length) || batch.length > 0) {
    // Keep revealing from max(0, cursor - batch) so acted jobs drop out and next fill in
    const start = Math.max(0, cursor - batchSize);
    const filled = dripBatch(queue, start, batchSize);
    return filled.nextCursor;
  }
  return nextCursor;
}

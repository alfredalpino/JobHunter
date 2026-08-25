import { and, eq, sql } from "drizzle-orm";
import { jobFingerprint } from "@/lib/eligibility";
import { clipJobSummary } from "@/lib/jobSummary";
import { getDb, type AppDb } from "@/lib/db/client";
import { clusters, ingestRuns, jobs, sources } from "@/lib/db/schema";
import { fetchJobsForQueries } from "@/lib/sources";
import type { HuntSourceResult, Job } from "@/lib/types";
import {
  applyUrlIdentity,
  contentHash,
  newClusterId,
  newIngestRunId,
  newJobId,
  normalizeCompany,
  normalizeTitle,
  shouldMergeClusters,
} from "./cluster";
import { buildIngestSeeds } from "./seeds";

export type IngestResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  runId?: string;
  fetched: number;
  upserted: number;
  seeds: number;
  sources: HuntSourceResult[];
  errors: { seed?: string; error: string }[];
};

function inferWorkMode(job: Job): string | null {
  const blob = `${job.title} ${job.location} ${job.summary}`.toLowerCase();
  if (/\bremote\b/.test(blob) && !/\bonsite only\b|\bon-site only\b/.test(blob)) {
    return "remote";
  }
  if (/\bhybrid\b/.test(blob)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin office\b/.test(blob)) return "onsite";
  return null;
}

async function upsertSource(
  db: AppDb,
  source: HuntSourceResult,
): Promise<void> {
  const now = new Date();
  await db
    .insert(sources)
    .values({
      id: source.id,
      label: source.name,
      lastOkAt: source.ok ? now : null,
      lastError: source.ok ? null : source.error || "failed",
      status: source.ok ? "ok" : "error",
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: source.ok
        ? {
            label: source.name,
            lastOkAt: now,
            lastError: null,
            status: "ok",
          }
        : {
            label: source.name,
            lastError: source.error || "failed",
            status: "error",
          },
    });
}

type MemCluster = {
  id: string;
  title: string;
  company: string;
  url: string;
  summary: string;
  contentHash: string;
  memberCount: number;
};

/**
 * Assign or merge a cluster for a listing. Uses in-memory map for the run
 * plus a soft DB lookup by normalized company+title.
 */
export async function assignCluster(
  db: AppDb,
  job: Job,
  mem: Map<string, MemCluster>,
): Promise<string> {
  const nTitle = normalizeTitle(job.title);
  const nCompany = normalizeCompany(job.company);
  const cHash = contentHash(job.summary || "");
  const urlId = applyUrlIdentity(job.url);

  for (const c of mem.values()) {
    if (
      shouldMergeClusters(
        {
          title: job.title,
          company: job.company,
          url: job.url,
          summary: job.summary,
        },
        {
          title: c.title,
          company: c.company,
          url: c.url,
          summary: c.summary,
        },
      ) ||
      (urlId && applyUrlIdentity(c.url) === urlId)
    ) {
      c.memberCount += 1;
      await db
        .update(clusters)
        .set({
          memberCount: c.memberCount,
          updatedAt: new Date(),
          contentHash: c.contentHash || cHash,
        })
        .where(eq(clusters.id, c.id));
      return c.id;
    }
  }

  const existing = await db
    .select()
    .from(clusters)
    .where(
      and(
        eq(clusters.canonicalCompany, nCompany),
        eq(clusters.canonicalTitle, nTitle),
      ),
    )
    .limit(8);

  for (const row of existing) {
    const softSame =
      normalizeTitle(job.title) === normalizeTitle(row.canonicalTitle) &&
      normalizeCompany(job.company) === normalizeCompany(row.canonicalCompany);
    const hashOk =
      !row.contentHash || !cHash || row.contentHash === cHash;
    if (softSame && hashOk) {
      const nextCount = (row.memberCount || 1) + 1;
      await db
        .update(clusters)
        .set({
          memberCount: nextCount,
          updatedAt: new Date(),
          contentHash: row.contentHash || cHash,
        })
        .where(eq(clusters.id, row.id));
      mem.set(row.id, {
        id: row.id,
        title: row.canonicalTitle,
        company: row.canonicalCompany,
        url: job.url,
        summary: job.summary || "",
        contentHash: row.contentHash || cHash,
        memberCount: nextCount,
      });
      return row.id;
    }
  }

  const id = newClusterId();
  await db.insert(clusters).values({
    id,
    canonicalTitle: nTitle || job.title.slice(0, 180),
    canonicalCompany: nCompany || job.company.slice(0, 120),
    memberCount: 1,
    contentHash: cHash,
  });
  mem.set(id, {
    id,
    title: nTitle || job.title,
    company: nCompany || job.company,
    url: job.url,
    summary: job.summary || "",
    contentHash: cHash,
    memberCount: 1,
  });
  return id;
}

/** Upsert one job by fingerprint and attach cluster. Pure-ish for unit tests via injected db. */
export async function upsertJobRow(
  db: AppDb,
  job: Job,
  memClusters: Map<string, MemCluster>,
): Promise<"inserted" | "updated"> {
  const fingerprint = jobFingerprint(job);
  const summary = clipJobSummary(job.summary || "");
  const now = new Date();
  const clusterId = await assignCluster(
    db,
    { ...job, summary },
    memClusters,
  );

  const existing = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.fingerprint, fingerprint))
    .limit(1);

  if (existing[0]) {
    await db
      .update(jobs)
      .set({
        title: job.title.slice(0, 180),
        company: job.company.slice(0, 120),
        url: job.url,
        portal: job.portal,
        location: (job.location || "").slice(0, 180),
        summary,
        postedAt: job.posted_at || "",
        workMode: inferWorkMode(job),
        lastSeenAt: now,
        isActive: true,
        linkStatus: "ok",
        clusterId,
        sourceId: job.portal || null,
      })
      .where(eq(jobs.fingerprint, fingerprint));
    return "updated";
  }

  await db.insert(jobs).values({
    id: newJobId(),
    fingerprint,
    title: job.title.slice(0, 180),
    company: job.company.slice(0, 120),
    url: job.url,
    portal: job.portal,
    location: (job.location || "").slice(0, 180),
    summary,
    postedAt: job.posted_at || "",
    workMode: inferWorkMode(job),
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
    linkStatus: "ok",
    clusterId,
    sourceId: job.portal || null,
  });
  return "inserted";
}

/**
 * Corpus ingest: seed queries → adapters → upsert by fingerprint → cluster.
 * No Gemini. Returns skipped if DATABASE_URL / getDb() is unavailable.
 */
export async function runIngest(opts?: {
  fresh?: boolean;
  maxSeeds?: number;
}): Promise<IngestResult> {
  const db = getDb();
  if (!db) {
    return {
      ok: false,
      skipped: true,
      reason: "DATABASE_URL not configured — ingest skipped",
      fetched: 0,
      upserted: 0,
      seeds: 0,
      sources: [],
      errors: [],
    };
  }

  const runId = newIngestRunId();
  const startedAt = new Date();
  await db.insert(ingestRuns).values({
    id: runId,
    startedAt,
    fetched: 0,
    upserted: 0,
    errors: [],
  });

  const seeds = buildIngestSeeds({ maxSeeds: opts?.maxSeeds ?? 12 });
  const errors: { seed?: string; error: string }[] = [];
  const allSources: HuntSourceResult[] = [];
  const seenFp = new Set<string>();
  const memClusters = new Map<string, MemCluster>();
  let fetched = 0;
  let upserted = 0;

  // Group seeds by region to reduce redundant worldwide remote scrapes
  const byRegion = new Map<string, typeof seeds>();
  for (const seed of seeds) {
    const list = byRegion.get(seed.regionId) || [];
    list.push(seed);
    byRegion.set(seed.regionId, list);
  }

  for (const [regionId, regionSeeds] of byRegion) {
    const queries = [...new Set(regionSeeds.map((s) => s.query))];
    const sample = regionSeeds[0];
    try {
      const { jobs: rawJobs, sources: srcs } = await fetchJobsForQueries({
        queries,
        regionId,
        country: sample.country,
        location: sample.location,
        fresh: opts?.fresh === true,
      });
      allSources.push(...srcs);
      for (const src of srcs) {
        try {
          await upsertSource(db, src);
        } catch (err) {
          errors.push({
            seed: regionId,
            error: `source upsert: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
      fetched += rawJobs.length;
      for (const job of rawJobs) {
        const fp = jobFingerprint(job);
        if (seenFp.has(fp)) continue;
        seenFp.add(fp);
        try {
          await upsertJobRow(db, job, memClusters);
          upserted += 1;
        } catch (err) {
          errors.push({
            seed: `${regionId}:${job.title}`,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      errors.push({
        seed: regionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db
    .update(ingestRuns)
    .set({
      finishedAt: new Date(),
      fetched,
      upserted,
      errors,
    })
    .where(eq(ingestRuns.id, runId));

  // Soft-deactivate jobs not seen in ~45 days (best-effort)
  try {
    await db.execute(sql`
      UPDATE jobs
      SET is_active = false
      WHERE is_active = true
        AND last_seen_at < NOW() - INTERVAL '45 days'
    `);
  } catch {
    /* optional on fresh DBs */
  }

  return {
    ok: true,
    runId,
    fetched,
    upserted,
    seeds: seeds.length,
    sources: allSources,
    errors,
  };
}

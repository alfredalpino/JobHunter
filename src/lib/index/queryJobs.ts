import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { clusters, jobs } from "@/lib/db/schema";
import { buildHuntQueries } from "@/lib/huntQueries";
import type { Job, Profile } from "@/lib/types";

export type IndexJob = Job & {
  fingerprint?: string;
  cluster_id?: string | null;
  cluster_member_count?: number;
  apply_urls?: string[];
};

export type QueryJobsResult = {
  jobs: IndexJob[];
  indexCount: number;
  available: boolean;
};

const DEFAULT_MAX = 2000;
const DEFAULT_RECENCY_DAYS = 45;

function keywordTokens(profile: Profile): string[] {
  const queries = buildHuntQueries(profile);
  const fromTitles = (profile.target_titles || []).flatMap((t) =>
    t.toLowerCase().split(/\s+/),
  );
  const fromSkills = (profile.skills_positive || [])
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 2)
    .slice(0, 12);
  const fromQueries = queries
    .flatMap((q) => q.toLowerCase().split(/\s+/))
    .filter((t) => t.length > 2);
  return [...new Set([...fromTitles, ...fromSkills, ...fromQueries])].slice(
    0,
    24,
  );
}

function rowToJob(
  row: typeof jobs.$inferSelect,
  memberCount?: number | null,
): IndexJob {
  return {
    title: row.title,
    company: row.company,
    url: row.url,
    portal: row.portal,
    location: row.location || "",
    summary: row.summary || "",
    posted_at: row.postedAt || "",
    source_method: "shared_index",
    fingerprint: row.fingerprint,
    cluster_id: row.clusterId,
    cluster_member_count: memberCount ?? undefined,
  };
}

/**
 * Load active jobs from the shared index for scoring.
 * Returns available:false when DB is missing or empty — caller should live-scrape.
 */
export async function queryJobsFromIndex(
  profile: Profile,
  opts?: { max?: number; recencyDays?: number },
): Promise<QueryJobsResult> {
  const db = getDb();
  if (!db) {
    return { jobs: [], indexCount: 0, available: false };
  }

  const max = opts?.max ?? DEFAULT_MAX;
  const recencyDays = opts?.recencyDays ?? DEFAULT_RECENCY_DAYS;
  const cutoff = new Date(Date.now() - recencyDays * 24 * 60 * 60 * 1000);

  try {
    const tokens = keywordTokens(profile);
    let rows: (typeof jobs.$inferSelect & {
      memberCount?: number | null;
    })[];

    if (tokens.length) {
      // Loose OR keyword filter on title/summary/company — keep corpus usable
      const pattern = tokens
        .slice(0, 10)
        .map((t) => t.replace(/[%_]/g, ""))
        .filter(Boolean);
      const likeClauses = pattern.flatMap((t) => [
        sql`${jobs.title} ILIKE ${"%" + t + "%"}`,
        sql`${jobs.summary} ILIKE ${"%" + t + "%"}`,
        sql`${jobs.company} ILIKE ${"%" + t + "%"}`,
      ]);

      rows = await db
        .select({
          id: jobs.id,
          fingerprint: jobs.fingerprint,
          title: jobs.title,
          company: jobs.company,
          url: jobs.url,
          portal: jobs.portal,
          location: jobs.location,
          summary: jobs.summary,
          postedAt: jobs.postedAt,
          workMode: jobs.workMode,
          raw: jobs.raw,
          firstSeenAt: jobs.firstSeenAt,
          lastSeenAt: jobs.lastSeenAt,
          isActive: jobs.isActive,
          linkStatus: jobs.linkStatus,
          clusterId: jobs.clusterId,
          sourceId: jobs.sourceId,
          memberCount: clusters.memberCount,
        })
        .from(jobs)
        .leftJoin(clusters, eq(jobs.clusterId, clusters.id))
        .where(
          and(
            eq(jobs.isActive, true),
            gte(jobs.lastSeenAt, cutoff),
            or(...likeClauses),
          ),
        )
        .orderBy(desc(jobs.lastSeenAt))
        .limit(max);
    } else {
      rows = await db
        .select({
          id: jobs.id,
          fingerprint: jobs.fingerprint,
          title: jobs.title,
          company: jobs.company,
          url: jobs.url,
          portal: jobs.portal,
          location: jobs.location,
          summary: jobs.summary,
          postedAt: jobs.postedAt,
          workMode: jobs.workMode,
          raw: jobs.raw,
          firstSeenAt: jobs.firstSeenAt,
          lastSeenAt: jobs.lastSeenAt,
          isActive: jobs.isActive,
          linkStatus: jobs.linkStatus,
          clusterId: jobs.clusterId,
          sourceId: jobs.sourceId,
          memberCount: clusters.memberCount,
        })
        .from(jobs)
        .leftJoin(clusters, eq(jobs.clusterId, clusters.id))
        .where(and(eq(jobs.isActive, true), gte(jobs.lastSeenAt, cutoff)))
        .orderBy(desc(jobs.lastSeenAt))
        .limit(max);
    }

    if (!rows.length) {
      // Fall back: any active jobs if keyword filter was too tight
      const fallback = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.isActive, true), gte(jobs.lastSeenAt, cutoff)))
        .orderBy(desc(jobs.lastSeenAt))
        .limit(Math.min(max, 500));
      if (!fallback.length) {
        return { jobs: [], indexCount: 0, available: false };
      }
      return {
        jobs: fallback.map((r) => rowToJob(r)),
        indexCount: fallback.length,
        available: true,
      };
    }

    // Deduplicate by cluster — prefer highest member_count / most recent portal row
    const byCluster = new Map<string, (typeof rows)[0]>();
    const unclustered: typeof rows = [];
    for (const row of rows) {
      if (!row.clusterId) {
        unclustered.push(row);
        continue;
      }
      const prev = byCluster.get(row.clusterId);
      if (!prev) {
        byCluster.set(row.clusterId, row);
        continue;
      }
      const prevMc = prev.memberCount || 1;
      const nextMc = row.memberCount || 1;
      if (nextMc > prevMc || row.lastSeenAt > prev.lastSeenAt) {
        byCluster.set(row.clusterId, row);
      }
    }

    const picked = [...byCluster.values(), ...unclustered];
    const out = picked.map((r) =>
      rowToJob(r, r.memberCount),
    );

    return {
      jobs: out,
      indexCount: out.length,
      available: out.length > 0,
    };
  } catch {
    return { jobs: [], indexCount: 0, available: false };
  }
}

/** Active job count in index (health / hunt probe). */
export async function countIndexJobs(): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.isActive, true));
    return rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}

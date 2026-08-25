import { NextResponse } from "next/server";
import { scoreAllJobsDetailed } from "@/lib/eligibility";
import {
  applyPreferencesToProfile,
  defaultPreferences,
  DATE_WINDOWS,
} from "@/lib/preferences";
import { queryJobsFromIndex } from "@/lib/index/queryJobs";
import { fetchJobsForProfile } from "@/lib/sources";
import { buildHuntQueries } from "@/lib/huntQueries";
import type { Job, Preferences, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

const SUMMARY_ELIGIBLE_MAX = 400;
const SUMMARY_INELIGIBLE_MAX = 200;

function trimJobForResponse(job: Job): Job {
  const keepFull =
    job.eligible &&
    (job.match?.band === "A" || job.match?.band === "B" || !job.match?.band);
  const max = keepFull ? SUMMARY_ELIGIBLE_MAX : SUMMARY_INELIGIBLE_MAX;
  const summary = (job.summary || "").slice(0, max);
  const { ai_note: _n, ai_bullets: _b, ...rest } = job;
  return { ...rest, summary };
}

function bucketJobs(jobs: Job[]) {
  const buckets: Record<
    | "last_7_days"
    | "days_8_to_14"
    | "days_15_to_21"
    | "days_22_to_30"
    | "older"
    | "unknown",
    Job[]
  > = {
    last_7_days: [],
    days_8_to_14: [],
    days_15_to_21: [],
    days_22_to_30: [],
    older: [],
    unknown: [],
  };
  for (const j of jobs) {
    const key = j.recency_bucket;
    if (key && key in buckets) {
      buckets[key as keyof typeof buckets].push(j);
    } else {
      buckets.unknown.push(j);
    }
  }
  return buckets;
}

/**
 * Prefer shared index when DATABASE_URL has jobs; else live scrape.
 * Date / eligible filtering still happens in the browser.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fresh = body?.fresh === true;
    const forceLive = body?.force_live === true;
    const profile = body?.profile as Profile | undefined;
    if (!profile || typeof profile !== "object") {
      return NextResponse.json(
        { ok: false, error: "Missing profile. Analyze a resume first." },
        { status: 400 },
      );
    }

    const prefsIn = (body?.preferences || {}) as Partial<Preferences>;
    const region =
      (typeof body?.region === "string" && body.region) ||
      prefsIn.region ||
      "dubai";
    const preferences: Preferences = {
      ...defaultPreferences(region),
      ...prefsIn,
      region,
    };

    // Never age-cap at scrape time — UI owns date windows
    const merged = applyPreferencesToProfile(profile, {
      ...preferences,
      recency_max_days: 99999,
      date_window: "any_age",
    });
    if (merged.recency) {
      merged.recency.max_age_days = 99999;
      merged.recency.reject_unknown_date = false;
    }

    const huntQueries = buildHuntQueries(merged);

    let rawJobs: Job[] = [];
    let sources: Awaited<
      ReturnType<typeof fetchJobsForProfile>
    >["sources"] = [];
    let huntSource: "index" | "live_scrape" = "live_scrape";
    let indexCount = 0;

    if (!forceLive && !fresh) {
      const indexed = await queryJobsFromIndex(merged);
      if (indexed.available && indexed.jobs.length > 0) {
        rawJobs = indexed.jobs;
        indexCount = indexed.indexCount;
        huntSource = "index";
        sources = [
          {
            id: "shared_index",
            name: "Shared job index",
            ok: true,
            count: indexed.indexCount,
            cached: true,
          },
        ];
      }
    }

    if (huntSource === "live_scrape") {
      const live = await fetchJobsForProfile(merged, { fresh });
      rawJobs = live.jobs;
      sources = live.sources;
    }

    const { jobs: scored, eligibleCount, dedupedCount } = scoreAllJobsDetailed(
      rawJobs,
      merged,
    );
    const trimmed = scored.map(trimJobForResponse);
    const buckets = bucketJobs(trimmed);
    const cachedSources = sources.filter((s) => s.cached).length;

    return NextResponse.json({
      ok: true,
      stub: false,
      auto_apply: false,
      source: huntSource,
      index_count: indexCount,
      fetched: rawJobs.length,
      scored_count: trimmed.length,
      eligible_count: eligibleCount,
      deduped_count: dedupedCount,
      cached_sources: cachedSources,
      hunt_queries: huntQueries,
      sources,
      profile: {
        name: merged.candidate.name,
        region: merged.geo?.region,
        max_job_level: merged.experience.max_job_level,
        search_queries: merged.search_queries,
        skills_positive: merged.skills_positive.slice(0, 20),
        target_titles: merged.target_titles.slice(0, 8),
      },
      /** Full pool — filter in the UI */
      jobs: trimmed,
      buckets,
      date_windows: DATE_WINDOWS,
      note:
        huntSource === "index"
          ? "Scored from shared job index. Date and fit filters apply in the app — no auto-apply."
          : "Live scrape (index empty or unavailable). Date and fit filters apply in the app — no auto-apply.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Hunt failed",
      },
      { status: 500 },
    );
  }
}

/** Readiness probe — does not scrape. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ready: true,
    method: "POST",
    linkedin_scrape: false,
    note: "POST JSON { profile, preferences? } to hunt. Prefers shared index when DATABASE_URL is populated; else live scrape of public APIs/RSS only (never LinkedIn). Response sources[] lists portal ok/fail/counts. GET is readiness only.",
  });
}

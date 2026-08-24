import { NextResponse } from "next/server";
import { scoreAllJobs } from "@/lib/eligibility";
import {
  applyPreferencesToProfile,
  defaultPreferences,
  DATE_WINDOWS,
} from "@/lib/preferences";
import { fetchJobsForProfile } from "@/lib/sources";
import type { Job, Preferences, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

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
 * Fetch ALL listings, score/annotate every one, return the full pool.
 * Date / eligible filtering happens in the browser.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const { jobs, sources } = await fetchJobsForProfile(merged);
    const scored = scoreAllJobs(jobs, merged);
    const eligible = scored.filter((j) => j.eligible);
    const buckets = bucketJobs(scored);

    return NextResponse.json({
      ok: true,
      stub: false,
      auto_apply: false,
      fetched: jobs.length,
      scored_count: scored.length,
      eligible_count: eligible.length,
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
      jobs: scored,
      buckets,
      date_windows: DATE_WINDOWS,
      note: "All scraped jobs returned. Date and fit filters apply in the app UI — no auto-apply. Web sources: Remote OK, Remotive, Arbeitnow, Jobicy, Himalayas, WWR, The Muse, NoDesk, Dynamite Jobs, USAJobs, Job Bank Canada, optional Adzuna/Jooble. Google Jobs / Indeed / LinkedIn / Glassdoor / Bayt need the Python CLI + JobSpy.",
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
    note: "POST JSON { profile, preferences? } to hunt. GET is readiness only.",
  });
}

import type { Job, HuntSourceResult, Profile } from "./types";
import { jobFingerprint } from "./eligibility";
import { buildHuntQueries, queryForSource } from "./huntQueries";
import { clipJobSummary, stripHtml } from "./jobSummary";
import { getScrapeCache, scrapeCacheKey, setScrapeCache } from "./scrape-cache";
import {
  jobicyTagFromQuery,
  matchesQuery,
  museCategoryForQuery,
  normalizePostedAt,
  parseJobBankHtml,
  parseRssItems,
  resolveAdzunaCountries,
} from "./sourceParse";

const UA =
  "JobHunter/1.0 (personal job search; https://github.com/alfredalpino/JobHunter)";

const FETCH_TIMEOUT_MS = 12_000;

/** Broad title tokens kept when RSS boards return mixed roles. */
const TECH_TITLE_RE =
  /\b(network|noc|engineer|developer|devops|sysadmin|security|analyst|administrator|support|help\s*desk|cloud|sre|technician|software|data|infrastructure)\b/i;

/**
 * Public Greenhouse board tokens (boards-api.greenhouse.io).
 * Official JSON only — no HTML hacking, no LinkedIn.
 */
export const GREENHOUSE_BOARD_TOKENS = [
  "gitlab",
  "stripe",
  "airbnb",
  "cloudflare",
  "hashicorp",
  "datadog",
  "discord",
  "notion",
] as const;

export type SourceInventoryEntry = {
  id: string;
  name: string;
  mode: "always" | "region" | "keyed";
  needsEnv?: string[];
  note: string;
};

/** Legal public inventory — LinkedIn is intentionally absent (ToS forbids scrape). */
export const SOURCE_INVENTORY: SourceInventoryEntry[] = [
  { id: "remoteok", name: "Remote OK", mode: "always", note: "Public JSON API" },
  { id: "remotive", name: "Remotive", mode: "always", note: "Public JSON API" },
  { id: "arbeitnow", name: "Arbeitnow", mode: "always", note: "Public JSON API" },
  { id: "jobicy", name: "Jobicy", mode: "always", note: "Public JSON API" },
  { id: "himalayas", name: "Himalayas", mode: "always", note: "Public JSON API" },
  { id: "wwr", name: "We Work Remotely", mode: "always", note: "Public category RSS" },
  { id: "themuse", name: "The Muse", mode: "always", note: "Public jobs API" },
  { id: "nodesk", name: "NoDesk", mode: "always", note: "remote-jobs/index.xml RSS" },
  {
    id: "greenhouse",
    name: "Greenhouse boards",
    mode: "always",
    note: "Public board JSON for seeded company tokens",
  },
  { id: "remotive_rss", name: "Remotive RSS", mode: "always", note: "Official remote jobs feed" },
  { id: "jobicy_rss", name: "Jobicy RSS", mode: "always", note: "Public jobs feed" },
  {
    id: "usajobs",
    name: "USAJobs",
    mode: "region",
    needsEnv: ["USAJOBS_API_KEY (optional)", "USAJOBS_USER_AGENT"],
    note: "USA / Washington packs",
  },
  {
    id: "jobbank_ca",
    name: "Job Bank Canada",
    mode: "region",
    note: "Canada / Alberta packs",
  },
  {
    id: "adzuna",
    name: "Adzuna",
    mode: "keyed",
    needsEnv: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
    note: "Optional ADZUNA_COUNTRIES for multi-market",
  },
  {
    id: "jooble",
    name: "Jooble",
    mode: "keyed",
    needsEnv: ["JOOBLE_API_KEY"],
    note: "Aggregator when key present",
  },
  {
    id: "findwork",
    name: "Findwork",
    mode: "keyed",
    needsEnv: ["FINDWORK_API_KEY"],
    note: "Token auth API",
  },
];

export function listSourceInventory(): SourceInventoryEntry[] {
  return SOURCE_INVENTORY.map((s) => ({ ...s }));
}

type FetchBundle = {
  jobs: Job[];
  sources: HuntSourceResult[];
};

export type QueryFetchOpts = {
  queries: string[];
  regionId?: string;
  country?: string;
  location?: string;
  fresh?: boolean;
};

/** Fetch from public adapters for arbitrary queries (profile hunt + corpus ingest). */
export async function fetchJobsForQueries(
  opts: QueryFetchOpts,
): Promise<FetchBundle> {
  const fresh = opts.fresh === true;
  const queries = (opts.queries || []).filter(Boolean);
  if (!queries.length) return { jobs: [], sources: [] };

  const primary = queries[0] || "engineer";
  const country = (opts.country || opts.regionId || "").toLowerCase();
  const location = opts.location || "";
  const regionId = (opts.regionId || "").toLowerCase();
  const cacheQuery = `${primary}|${queries.join(",")}`;

  const tasks: Promise<{ jobs: Job[]; source: HuntSourceResult }>[] = [
    wrap("remoteok", "Remote OK", () => fetchRemoteOk(queries), cacheQuery, regionId, fresh),
    wrap("remotive", "Remotive", () => fetchRemotive(queries), cacheQuery, regionId, fresh),
    wrap("arbeitnow", "Arbeitnow", () => fetchArbeitnow(queryForSource(queries, 2)), cacheQuery, regionId, fresh),
    wrap("jobicy", "Jobicy", () => fetchJobicy(queryForSource(queries, 3)), cacheQuery, regionId, fresh),
    wrap("himalayas", "Himalayas", () => fetchHimalayas(queries), cacheQuery, regionId, fresh),
    wrap("wwr", "We Work Remotely", () => fetchWwrRss(queries), cacheQuery, regionId, fresh),
    wrap("themuse", "The Muse", () => fetchTheMuse(queryForSource(queries, 5), location), cacheQuery, regionId, fresh),
    wrap("nodesk", "NoDesk", () => fetchNodeskRss(queries), cacheQuery, regionId, fresh),
    wrap(
      "greenhouse",
      "Greenhouse boards",
      () => fetchGreenhouseBoards(queries),
      cacheQuery,
      regionId,
      fresh,
    ),
    // Remotive official RSS (extra remote coverage)
    wrap("remotive_rss", "Remotive RSS", () => fetchRemotiveRss(queries), cacheQuery, regionId, fresh),
    // Jobicy public RSS
    wrap("jobicy_rss", "Jobicy RSS", () => fetchJobicyRss(queries), cacheQuery, regionId, fresh),
  ];

  if (regionId === "usa" || regionId === "washington" || country === "usa") {
    tasks.push(
      wrap("usajobs", "USAJobs", () => fetchUsaJobs(primary, location), cacheQuery, regionId, fresh),
    );
  }

  // Official Canadian federal job bank (no key) for Canada / Alberta packs
  if (regionId === "alberta" || country === "canada") {
    tasks.push(
      wrap("jobbank_ca", "Job Bank Canada", () =>
        fetchJobBankCanada(primary, location),
      cacheQuery, regionId, fresh),
    );
  }

  const adzunaId = process.env.ADZUNA_APP_ID;
  const adzunaKey = process.env.ADZUNA_APP_KEY;
  if (adzunaId && adzunaKey) {
    const countries = resolveAdzunaCountries(regionId, country);
    for (const cc of countries) {
      const sid = countries.length === 1 ? "adzuna" : `adzuna_${cc}`;
      const label =
        countries.length === 1 ? "Adzuna" : `Adzuna (${cc.toUpperCase()})`;
      tasks.push(
        wrap(sid, label, () =>
          fetchAdzuna(primary, location, cc, adzunaId, adzunaKey),
        cacheQuery, regionId, fresh),
      );
    }
  }

  // Jooble public-ish API when key present (major aggregator; authentic listings)
  const joobleKey = process.env.JOOBLE_API_KEY;
  if (joobleKey) {
    tasks.push(
      wrap("jooble", "Jooble", () =>
        fetchJooble(primary, location, joobleKey),
      cacheQuery, regionId, fresh),
    );
  }

  const findworkKey = process.env.FINDWORK_API_KEY;
  if (findworkKey) {
    tasks.push(
      wrap(
        "findwork",
        "Findwork",
        () => fetchFindwork(primary, findworkKey),
        cacheQuery,
        regionId,
        fresh,
      ),
    );
  }

  const settled = await Promise.all(tasks);
  const jobs: Job[] = [];
  const sources: HuntSourceResult[] = [];
  const seenUrl = new Set<string>();
  const seenFp = new Set<string>();

  for (const item of settled) {
    sources.push(item.source);
    for (const job of item.jobs) {
      if (!job.url || seenUrl.has(job.url)) continue;
      const fp = jobFingerprint(job);
      if (seenFp.has(fp)) continue;
      seenUrl.add(job.url);
      seenFp.add(fp);
      jobs.push(job);
    }
  }

  return { jobs, sources };
}

/**
 * Prefer ADZUNA_COUNTRIES env (comma-separated ISO codes), else map region
 * and expand remote packs across a few markets (capped).
 */
export { resolveAdzunaCountries };

export async function fetchJobsForProfile(
  profile: Profile,
  opts?: { fresh?: boolean },
): Promise<FetchBundle> {
  const queries = buildHuntQueries(profile);
  return fetchJobsForQueries({
    queries,
    regionId: (profile.geo?.region || "").toLowerCase(),
    country:
      profile.geo?.country_indeed?.toLowerCase() ||
      profile.geo?.region ||
      "",
    location:
      profile.geo?.default_locations?.[0] ||
      profile.candidate?.location ||
      "",
    fresh: opts?.fresh === true,
  });
}

async function wrap(
  id: string,
  name: string,
  fn: () => Promise<Job[]>,
  queryKey: string,
  region: string,
  fresh: boolean,
): Promise<{ jobs: Job[]; source: HuntSourceResult }> {
  const cacheKey = scrapeCacheKey(id, queryKey, region);

  if (!fresh) {
    const cached = getScrapeCache<Job[]>(cacheKey);
    if (cached) {
      return {
        jobs: cached,
        source: { id, name, ok: true, count: cached.length, cached: true },
      };
    }
  }

  try {
    const jobs = await fetchWithRetry(fn);
    setScrapeCache(cacheKey, jobs);
    return {
      jobs,
      source: { id, name, ok: true, count: jobs.length },
    };
  } catch (err) {
    return {
      jobs: [],
      source: {
        id,
        name,
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function fetchWithRetry(fn: () => Promise<Job[]>): Promise<Job[]> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/429|rate limit|401|403/i.test(msg)) throw err;
    await new Promise((r) => setTimeout(r, 350));
    return await fn();
  }
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function keepRssJob(blob: string, queries: string[]): boolean {
  if (!queries.length) return true;
  return matchesQuery(blob, queries) || TECH_TITLE_RE.test(blob);
}

async function fetchRemoteOk(queries: string[]): Promise<Job[]> {
  const data = (await fetchJson("https://remoteok.com/api")) as unknown[];
  const jobs: Job[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!r.position) continue;
    const title = String(r.position);
    const tags = Array.isArray(r.tags) ? r.tags.map(String).join(" ") : "";
    const rawDesc = String(r.description || "");
    const blob = `${title} ${r.location || ""} ${tags} ${stripHtml(rawDesc)}`;
    if (!keepRssJob(blob, queries)) continue;
    const url = String(r.url || r.apply_url || "");
    if (!url) continue;
    const epoch = r.epoch != null ? r.epoch : r.date;
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company || "unspecified").slice(0, 120),
      url,
      portal: "remoteok",
      location: String(r.location || "Remote"),
      summary: clipJobSummary(rawDesc),
      posted_at: normalizePostedAt(epoch),
      source_method: "remoteok_api",
      query: queries[0],
    });
    if (jobs.length >= 80) break;
  }
  return jobs;
}

async function fetchRemotive(queries: string[]): Promise<Job[]> {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const query of queries.slice(0, 3)) {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`;
    const data = (await fetchJson(url)) as { jobs?: unknown[] };
    for (const row of data.jobs || []) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const jobUrl = String(r.url || r.canonical_url || "");
      const title = String(r.title || "");
      if (!jobUrl || !title || seen.has(jobUrl)) continue;
      seen.add(jobUrl);
      jobs.push({
        title: title.slice(0, 180),
        company: String(r.company_name || "unspecified").slice(0, 120),
        url: jobUrl,
        portal: "remotive",
        location: String(r.candidate_required_location || "Remote"),
        summary: clipJobSummary(String(r.description || "")),
        posted_at: normalizePostedAt(r.publication_date),
        source_method: "remotive_api",
        query,
      });
    }
  }
  return jobs;
}

async function fetchArbeitnow(query: string): Promise<Job[]> {
  const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`;
  const data = (await fetchJson(url)) as { data?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.data || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const jobUrl = String(r.url || "");
    const title = String(r.title || "");
    if (!jobUrl || !title) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company_name || "unspecified").slice(0, 120),
      url: jobUrl,
      portal: "arbeitnow",
      location: String(r.location || "Remote"),
      summary: clipJobSummary(String(r.description || "")),
      posted_at: normalizePostedAt(r.created_at),
      source_method: "arbeitnow_api",
      query,
    });
    if (jobs.length >= 60) break;
  }
  return jobs;
}

async function fetchJobicy(query: string): Promise<Job[]> {
  const tag = jobicyTagFromQuery(query);
  const url = `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`;
  const data = (await fetchJson(url)) as { jobs?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.jobs || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const jobUrl = String(r.url || r.id || "");
    const title = String(r.jobTitle || r.title || "");
    if (!jobUrl || !title) continue;
    const href = jobUrl.startsWith("http")
      ? jobUrl
      : `https://jobicy.com/jobs/${jobUrl}`;
    const desc = String(r.jobDescription || r.description || "");
    const blob = `${title} ${desc}`;
    // Tag endpoints are broad — keep query-relevant rows when possible
    if (query && !keepRssJob(blob, [query]) && jobs.length >= 15) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.companyName || r.company || "unspecified").slice(0, 120),
      url: href,
      portal: "jobicy",
      location: String(r.jobGeo || r.location || "Remote"),
      summary: clipJobSummary(desc),
      posted_at: normalizePostedAt(r.pubDate || r.publishedDate),
      source_method: "jobicy_api",
      query,
    });
  }
  return jobs;
}

async function fetchHimalayas(queries: string[]): Promise<Job[]> {
  const q = queries[0] || "engineer";
  const url = `https://himalayas.app/jobs/api?limit=40&q=${encodeURIComponent(q)}`;
  const data = (await fetchJson(url)) as { jobs?: unknown[] } | unknown[];
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { jobs?: unknown[] }).jobs)
      ? (data as { jobs: unknown[] }).jobs
      : [];
  const jobs: Job[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || r.name || "");
    let href = String(r.applicationLink || r.url || "");
    if (!href && r.slug) href = `https://himalayas.app/jobs/${r.slug}`;
    if (!href.startsWith("http") && r.slug) {
      href = `https://himalayas.app/jobs/${r.slug}`;
    }
    if (!title || !href.startsWith("http")) continue;

    const locs = Array.isArray(r.locationRestrictions)
      ? (r.locationRestrictions as unknown[]).map(String).join(", ")
      : String(r.location || r.jobLocation || "Remote");
    const desc = String(r.description || r.excerpt || "");
    const blob = `${title} ${locs} ${stripHtml(desc)}`;
    // API `q` is weak — filter client-side so teaching/unrelated roles don't flood
    if (!keepRssJob(blob, queries)) continue;

    jobs.push({
      title: title.slice(0, 180),
      company: String(
        (r.companyName as string) ||
          (r.company as { name?: string })?.name ||
          "unspecified",
      ).slice(0, 120),
      url: href,
      portal: "himalayas",
      location: locs || "Remote",
      summary: clipJobSummary(desc),
      posted_at: normalizePostedAt(r.pubDate ?? r.published_at),
      source_method: "himalayas_api",
      query: q,
    });
  }
  return jobs;
}

async function fetchWwrRss(queries: string[] = []): Promise<Job[]> {
  const feeds = [
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    "https://weworkremotely.com/remote-jobs.rss",
  ];
  const jobs: Job[] = [];
  const seen = new Set<string>();
  let feedOk = 0;
  const errors: string[] = [];
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed);
      feedOk += 1;
      for (const item of parseRssItems(xml)) {
        if (seen.has(item.link)) continue;
        const company =
          item.title.includes(":")
            ? item.title.split(":")[0].trim()
            : "unspecified";
        const role = item.title.includes(":")
          ? item.title.slice(item.title.indexOf(":") + 1).trim()
          : item.title;
        const blob = `${role} ${item.description}`;
        if (!keepRssJob(blob, queries)) continue;
        seen.add(item.link);
        jobs.push({
          title: role.slice(0, 180),
          company: company.slice(0, 120),
          url: item.link,
          portal: "weworkremotely",
          location: "Remote",
          summary: clipJobSummary(item.description),
          posted_at: normalizePostedAt(item.pubDate),
          source_method: "rss",
          query: queries[0],
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (!feedOk) {
    throw new Error(
      `WWR RSS all feeds failed: ${errors.slice(0, 2).join("; ") || "unknown"}`,
    );
  }
  return jobs;
}

async function fetchRemotiveRss(queries: string[] = []): Promise<Job[]> {
  const xml = await fetchText("https://remotive.com/remote-jobs/feed");
  const jobs: Job[] = [];
  for (const item of parseRssItems(xml)) {
    const blob = `${item.title} ${item.description}`;
    if (!keepRssJob(blob, queries)) continue;
    const company =
      item.title.includes(":")
        ? item.title.split(":")[0].trim()
        : "unspecified";
    const role = item.title.includes(":")
      ? item.title.slice(item.title.indexOf(":") + 1).trim()
      : item.title;
    jobs.push({
      title: role.slice(0, 180),
      company: company.slice(0, 120),
      url: item.link,
      portal: "remotive",
      location: "Remote",
      summary: clipJobSummary(item.description),
      posted_at: normalizePostedAt(item.pubDate),
      source_method: "rss",
      query: queries[0],
    });
    if (jobs.length >= 60) break;
  }
  return jobs;
}

async function fetchJobicyRss(queries: string[] = []): Promise<Job[]> {
  const xml = await fetchText("https://jobicy.com/jobs/feed");
  const jobs: Job[] = [];
  for (const item of parseRssItems(xml)) {
    const blob = `${item.title} ${item.description}`;
    if (!keepRssJob(blob, queries)) continue;
    jobs.push({
      title: item.title.slice(0, 180),
      company: "unspecified",
      url: item.link,
      portal: "jobicy",
      location: "Remote",
      summary: clipJobSummary(item.description),
      posted_at: normalizePostedAt(item.pubDate),
      source_method: "rss",
      query: queries[0],
    });
    if (jobs.length >= 60) break;
  }
  return jobs;
}

async function fetchNodeskRss(queries: string[] = []): Promise<Job[]> {
  // Old /remote-jobs/feed.xml 404s; Hugo category feeds use index.xml
  const feeds = [
    "https://nodesk.co/remote-jobs/index.xml",
    "https://nodesk.co/remote-jobs/engineering/index.xml",
  ];
  const jobs: Job[] = [];
  const seen = new Set<string>();
  let feedOk = 0;
  const errors: string[] = [];
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed);
      feedOk += 1;
      for (const item of parseRssItems(xml)) {
        if (seen.has(item.link)) continue;
        const atMatch = item.title.match(/^(.+?)\s+at\s+(.+)$/i);
        const role = (atMatch?.[1] || item.title).trim();
        const company = (atMatch?.[2] || "unspecified").trim();
        const blob = `${role} ${company} ${item.description}`;
        if (!keepRssJob(blob, queries)) continue;
        seen.add(item.link);
        jobs.push({
          title: role.slice(0, 180),
          company: company.slice(0, 120),
          url: item.link,
          portal: "nodesk",
          location: "Remote",
          summary: clipJobSummary(item.description),
          posted_at: normalizePostedAt(item.pubDate),
          source_method: "rss",
          query: queries[0],
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (!feedOk) {
    throw new Error(
      `NoDesk feeds failed: ${errors.slice(0, 2).join("; ") || "unknown"}`,
    );
  }
  return jobs;
}

/** Official Greenhouse public board JSON for seeded company tokens. */
async function fetchGreenhouseBoards(queries: string[]): Promise<Job[]> {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const tokens = GREENHOUSE_BOARD_TOKENS.slice(0, 8);
  const settled = await Promise.all(
    tokens.map(async (token) => {
      try {
        const data = (await fetchJson(
          `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`,
        )) as { jobs?: unknown[] };
        return { token, rows: data.jobs || [], ok: true };
      } catch {
        return { token, rows: [] as unknown[], ok: false };
      }
    }),
  );
  const boardOk = settled.filter((s) => s.ok).length;
  for (const { token, rows } of settled) {
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const title = String(r.title || "");
      const href = String(r.absolute_url || "");
      if (!title || !href.startsWith("http") || seen.has(href)) continue;
      const company = String(r.company_name || token).slice(0, 120);
      const loc =
        (r.location as { name?: string } | undefined)?.name || "Remote";
      const blob = `${title} ${company} ${loc}`;
      if (!keepRssJob(blob, queries)) continue;
      seen.add(href);
      jobs.push({
        title: title.slice(0, 180),
        company,
        url: href,
        portal: "greenhouse",
        location: String(loc),
        summary: "",
        posted_at: normalizePostedAt(r.updated_at || r.first_published),
        source_method: "greenhouse_board_api",
        query: queries[0],
      });
      if (jobs.length >= 80) return jobs;
    }
  }
  if (!boardOk) throw new Error("All Greenhouse board fetches failed");
  return jobs;
}

async function fetchFindwork(query: string, apiKey: string): Promise<Job[]> {
  const params = new URLSearchParams({ search: query, sort_by: "date" });
  const data = (await fetchJson(`https://findwork.dev/api/jobs/?${params}`, {
    headers: { Authorization: `Token ${apiKey}` },
  })) as { results?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.results || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.role || r.title || "");
    const href = String(r.url || "");
    if (!title || !href) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company_name || "unspecified").slice(0, 120),
      url: href,
      portal: "findwork",
      location: String(r.location || "Remote"),
      summary: clipJobSummary(String(r.text || r.description || "")),
      posted_at: normalizePostedAt(r.date_posted || r.created),
      source_method: "findwork_api",
      query,
    });
    if (jobs.length >= 50) break;
  }
  return jobs;
}

async function fetchUsaJobs(query: string, location: string): Promise<Job[]> {
  const params = new URLSearchParams({
    Keyword: query,
    DatePosted: "14",
    ResultsPerPage: "40",
  });
  if (location) params.set("LocationName", location.replace(/\(target\)/i, "").trim());
  const url = `https://data.usajobs.gov/api/search?${params}`;
  const headers: Record<string, string> = {
    "User-Agent": process.env.USAJOBS_USER_AGENT || "jobhunter@alubaid.xyz",
    Host: "data.usajobs.gov",
  };
  if (process.env.USAJOBS_API_KEY) {
    headers["Authorization-Key"] = process.env.USAJOBS_API_KEY;
  }
  const data = (await fetchJson(url, { headers })) as {
    SearchResult?: { SearchResultItems?: unknown[] };
  };
  const jobs: Job[] = [];
  for (const row of data.SearchResult?.SearchResultItems || []) {
    if (!row || typeof row !== "object") continue;
    const matched = (row as { MatchedObjectDescriptor?: Record<string, unknown> })
      .MatchedObjectDescriptor;
    if (!matched) continue;
    const title = String(matched.PositionTitle || "");
    const apply =
      (matched.ApplyURI as string[] | undefined)?.[0] ||
      String(matched.PositionURI || "");
    if (!title || !apply) continue;
    const org = matched.OrganizationName
      ? String(matched.OrganizationName)
      : "USAJobs";
    const locs = Array.isArray(matched.PositionLocation)
      ? (matched.PositionLocation as { LocationName?: string }[])
          .map((l) => l.LocationName)
          .filter(Boolean)
          .join(", ")
      : "";
    const pub = String(matched.PublicationStartDate || "");
    const userArea = matched.UserArea as
      | { Details?: { JobSummary?: string } }
      | undefined;
    const summaryRaw =
      userArea?.Details?.JobSummary ||
      matched.QualificationSummary ||
      "";
    jobs.push({
      title: title.slice(0, 180),
      company: org.slice(0, 120),
      url: apply,
      portal: "usajobs",
      location: locs || location || "United States",
      summary: clipJobSummary(String(summaryRaw)),
      posted_at: pub.slice(0, 10),
      source_method: "usajobs_api",
      query,
    });
  }
  return jobs;
}

async function fetchAdzuna(
  query: string,
  location: string,
  country: string,
  appId: string,
  appKey: string,
): Promise<Job[]> {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "40",
    what: query,
    max_days_old: "14",
    content_type: "jobs",
  });
  if (location) params.set("where", location.replace(/\(target\)/i, "").trim());
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
  const data = (await fetchJson(url)) as { results?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.results || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const jobUrl = String(r.redirect_url || r.url || "");
    const title = String(r.title || "");
    if (!jobUrl || !title) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: String(
        (r.company as { display_name?: string })?.display_name || "unspecified",
      ).slice(0, 120),
      url: jobUrl,
      portal: "adzuna",
      location: String(
        (r.location as { display_name?: string })?.display_name || location,
      ),
      summary: clipJobSummary(String(r.description || "")),
      posted_at: normalizePostedAt(r.created),
      source_method: "adzuna_api",
      query,
    });
  }
  return jobs;
}

async function fetchTheMuse(query: string, location: string): Promise<Job[]> {
  const params = new URLSearchParams({ page: "0", descending: "true" });
  const loc = location.replace(/\(target\)/i, "").trim();
  if (loc) params.append("location", loc);
  params.append("category", museCategoryForQuery(query));
  const url = `https://www.themuse.com/api/public/jobs?${params}`;
  const data = (await fetchJson(url)) as { results?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.results || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.name || "");
    const refs = r.refs as { landing_page?: string } | undefined;
    const href = String(refs?.landing_page || "");
    if (!title || !href) continue;
    const company = String(
      (r.company as { name?: string } | undefined)?.name || "unspecified",
    );
    const locs = Array.isArray(r.locations)
      ? (r.locations as { name?: string }[])
          .map((l) => l.name)
          .filter(Boolean)
          .join(", ")
      : "";
    const desc = stripHtml(String(r.contents || ""));
    const blob = `${title} ${company} ${locs} ${desc}`;
    if (!keepRssJob(blob, [query])) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: company.slice(0, 120),
      url: href,
      portal: "themuse",
      location: locs || loc || "Remote",
      summary: clipJobSummary(desc),
      posted_at: normalizePostedAt(r.publication_date),
      source_method: "themuse_api",
      query,
    });
    if (jobs.length >= 50) break;
  }
  return jobs;
}

async function fetchJobBankCanada(
  query: string,
  location: string,
): Promise<Job[]> {
  const loc = location.replace(/\(target\)/i, "").trim() || "Canada";
  const params = new URLSearchParams({
    searchstring: query,
    locationstring: loc,
    sort: "M",
  });
  const url = `https://www.jobbank.gc.ca/jobsearch/?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return parseJobBankHtml(html, loc).map((row) => ({
    title: row.title,
    company: row.company,
    url: row.url,
    portal: "jobbank_ca",
    location: row.location,
    summary: row.summary,
    posted_at: row.posted_at,
    source_method: "html_list",
    query,
  }));
}

async function fetchJooble(
  query: string,
  location: string,
  apiKey: string,
): Promise<Job[]> {
  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      keywords: query,
      location: location.replace(/\(target\)/i, "").trim(),
      page: 1,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: unknown[] };
  const jobs: Job[] = [];
  for (const row of data.jobs || []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const jobUrl = String(r.link || r.url || "");
    const title = String(r.title || "");
    if (!jobUrl || !title) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company || "unspecified").slice(0, 120),
      url: jobUrl,
      portal: "jooble",
      location: String(r.location || location),
      summary: clipJobSummary(String(r.snippet || r.description || "")),
      posted_at: normalizePostedAt(r.updated || r.pubDate),
      source_method: "jooble_api",
      query,
    });
  }
  return jobs;
}

export { matchesQuery };

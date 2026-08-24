import type { Job, HuntSourceResult, Profile } from "./types";

const UA =
  "JobHunter/1.0 (personal job search; https://github.com/alfredalpino/JobHunter)";

const ADZUNA_COUNTRY: Record<string, string> = {
  uae: "ae",
  usa: "us",
  india: "in",
  canada: "ca",
  poland: "pl",
  uk: "gb",
  gb: "gb",
};

type FetchBundle = {
  jobs: Job[];
  sources: HuntSourceResult[];
};

export async function fetchJobsForProfile(
  profile: Profile,
): Promise<FetchBundle> {
  const queries =
    (profile.search_queries?.length
      ? profile.search_queries
      : profile.target_titles
    )?.slice(0, 3) || ["software engineer"];
  const primary = queries[0] || "engineer";
  const country =
    profile.geo?.country_indeed?.toLowerCase() ||
    profile.geo?.region ||
    "";
  const location =
    profile.geo?.default_locations?.[0] ||
    profile.candidate?.location ||
    "";
  const regionId = (profile.geo?.region || "").toLowerCase();

  const tasks: Promise<{ jobs: Job[]; source: HuntSourceResult }>[] = [
    wrap("remoteok", "Remote OK", () => fetchRemoteOk(queries)),
    wrap("remotive", "Remotive", () => fetchRemotive(queries)),
    wrap("arbeitnow", "Arbeitnow", () => fetchArbeitnow(primary)),
    wrap("jobicy", "Jobicy", () => fetchJobicy(primary)),
    wrap("himalayas", "Himalayas", () => fetchHimalayas(primary)),
    wrap("wwr", "We Work Remotely", () => fetchWwrRss()),
    wrap("themuse", "The Muse", () => fetchTheMuse(primary, location)),
    wrap("nodesk", "NoDesk", () => fetchNodeskRss()),
    wrap("dynamitejobs", "Dynamite Jobs", () => fetchDynamiteJobs(primary)),
  ];

  if (regionId === "usa" || regionId === "washington" || country === "usa") {
    tasks.push(
      wrap("usajobs", "USAJobs", () => fetchUsaJobs(primary, location)),
    );
  }

  // Official Canadian federal job bank (no key) for Canada / Alberta packs
  if (regionId === "alberta" || country === "canada") {
    tasks.push(
      wrap("jobbank_ca", "Job Bank Canada", () =>
        fetchJobBankCanada(primary, location),
      ),
    );
  }

  const adzunaId = process.env.ADZUNA_APP_ID;
  const adzunaKey = process.env.ADZUNA_APP_KEY;
  if (adzunaId && adzunaKey) {
    const cc =
      ADZUNA_COUNTRY[country] ||
      ADZUNA_COUNTRY[regionId] ||
      "us";
    tasks.push(
      wrap("adzuna", "Adzuna", () =>
        fetchAdzuna(primary, location, cc, adzunaId, adzunaKey),
      ),
    );
  }

  // Jooble public-ish API when key present (major aggregator; authentic listings)
  const joobleKey = process.env.JOOBLE_API_KEY;
  if (joobleKey) {
    tasks.push(
      wrap("jooble", "Jooble", () =>
        fetchJooble(primary, location, joobleKey),
      ),
    );
  }

  const settled = await Promise.all(tasks);
  const jobs: Job[] = [];
  const sources: HuntSourceResult[] = [];
  const seen = new Set<string>();

  for (const item of settled) {
    sources.push(item.source);
    for (const job of item.jobs) {
      if (!job.url || seen.has(job.url)) continue;
      seen.add(job.url);
      jobs.push(job);
    }
  }

  return { jobs, sources };
}

async function wrap(
  id: string,
  name: string,
  fn: () => Promise<Job[]>,
): Promise<{ jobs: Job[]; source: HuntSourceResult }> {
  try {
    const jobs = await fn();
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
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml, */*" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function matchesQuery(blob: string, queries: string[]): boolean {
  const low = blob.toLowerCase();
  return queries.some((q) => {
    const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (!tokens.length) return low.includes(q.toLowerCase());
    return tokens.every((t) => low.includes(t)) || low.includes(q.toLowerCase());
  });
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
    const desc = stripHtml(String(r.description || "")).slice(0, 500);
    const blob = `${title} ${r.location || ""} ${tags} ${desc}`;
    if (!matchesQuery(blob, queries) && !/\b(network|noc|engineer|developer|support|devops|cloud|security|analyst)\b/i.test(title)) {
      continue;
    }
    const url = String(r.url || r.apply_url || "");
    if (!url) continue;
    const epoch = r.epoch != null ? String(r.epoch) : String(r.date || "");
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company || "unspecified").slice(0, 120),
      url,
      portal: "remoteok",
      location: String(r.location || "Remote"),
      summary: desc.slice(0, 400),
      posted_at: epoch,
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
  for (const query of queries.slice(0, 2)) {
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
        summary: stripHtml(String(r.description || "")).slice(0, 400),
        posted_at: String(r.publication_date || ""),
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
    const created = r.created_at != null ? String(r.created_at) : "";
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.company_name || "unspecified").slice(0, 120),
      url: jobUrl,
      portal: "arbeitnow",
      location: String(r.location || "Remote"),
      summary: stripHtml(String(r.description || "")).slice(0, 400),
      posted_at: created,
      source_method: "arbeitnow_api",
      query,
    });
    if (jobs.length >= 60) break;
  }
  return jobs;
}

async function fetchJobicy(query: string): Promise<Job[]> {
  const url = `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(query.split(/\s+/)[0] || "dev")}`;
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
    jobs.push({
      title: title.slice(0, 180),
      company: String(r.companyName || r.company || "unspecified").slice(0, 120),
      url: href,
      portal: "jobicy",
      location: String(r.jobGeo || r.location || "Remote"),
      summary: stripHtml(String(r.jobDescription || r.description || "")).slice(
        0,
        400,
      ),
      posted_at: String(r.pubDate || r.publishedDate || ""),
      source_method: "jobicy_api",
      query,
    });
  }
  return jobs;
}

async function fetchHimalayas(query: string): Promise<Job[]> {
  const url = `https://himalayas.app/jobs/api?limit=40&q=${encodeURIComponent(query)}`;
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
    const jobUrl = String(
      r.applicationLink || r.url || r.guid || r.excerpt || "",
    );
    // Himalayas often uses relative paths
    let href = String(r.applicationLink || r.url || "");
    if (!href && r.slug) href = `https://himalayas.app/jobs/${r.slug}`;
    if (!href.startsWith("http") && r.slug) {
      href = `https://himalayas.app/jobs/${r.slug}`;
    }
    if (!title || !href.startsWith("http")) continue;
    const pub =
      r.pubDate != null
        ? String(r.pubDate)
        : r.published_at != null
          ? String(r.published_at)
          : "";
    jobs.push({
      title: title.slice(0, 180),
      company: String(
        (r.companyName as string) ||
          (r.company as { name?: string })?.name ||
          "unspecified",
      ).slice(0, 120),
      url: href,
      portal: "himalayas",
      location: String(r.location || r.jobLocation || "Remote"),
      summary: stripHtml(String(r.description || r.excerpt || "")).slice(0, 400),
      posted_at: pub.includes("T") || /^\d+$/.test(pub) ? pub : pub,
      source_method: "himalayas_api",
      query,
    });
    void jobUrl;
  }
  return jobs;
}

async function fetchWwrRss(): Promise<Job[]> {
  const feeds = [
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/remote-jobs.rss",
  ];
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed);
      for (const item of xml.split(/<item>/i).slice(1)) {
        const title = decodeXml(
          (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) ||
            [])[1] || "",
        );
        const link = (
          item.match(/<link>([^<]+)<\/link>/i) ||
          item.match(/<guid[^>]*>([^<]+)<\/guid>/i) ||
          []
        )[1]?.trim();
        const pubDate = (
          item.match(/<pubDate>([^<]+)<\/pubDate>/i) || []
        )[1]?.trim();
        const desc = decodeXml(
          (item.match(
            /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
          ) || [])[1] || "",
        );
        if (!title || !link || seen.has(link)) continue;
        seen.add(link);
        const company =
          title.includes(":") ? title.split(":")[0].trim() : "unspecified";
        const role = title.includes(":")
          ? title.slice(title.indexOf(":") + 1).trim()
          : title;
        jobs.push({
          title: role.slice(0, 180),
          company: company.slice(0, 120),
          url: link,
          portal: "weworkremotely",
          location: "Remote",
          summary: stripHtml(desc).slice(0, 400),
          posted_at: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
          source_method: "rss",
        });
      }
    } catch {
      /* try next feed */
    }
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
    "User-Agent": process.env.USAJOBS_USER_AGENT || "jobhunter@alfredterminal.xyz",
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
      summary: stripHtml(String(summaryRaw)).slice(0, 400),
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
      summary: stripHtml(String(r.description || "")).slice(0, 400),
      posted_at: String(r.created || "").slice(0, 10),
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
    if (!matchesQuery(blob, [query])) continue;
    jobs.push({
      title: title.slice(0, 180),
      company: company.slice(0, 120),
      url: href,
      portal: "themuse",
      location: locs || loc || "Remote",
      summary: desc.slice(0, 400),
      posted_at: String(r.publication_date || "").slice(0, 10),
      source_method: "themuse_api",
      query,
    });
    if (jobs.length >= 50) break;
  }
  return jobs;
}

async function fetchNodeskRss(): Promise<Job[]> {
  const xml = await fetchText("https://nodesk.co/remote-jobs/feed.xml");
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const item of xml.split(/<item>/i).slice(1)) {
    const title = decodeXml(
      (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) ||
        [])[1] || "",
    );
    const link = (
      item.match(/<link>([^<]+)<\/link>/i) ||
      item.match(/<guid[^>]*>([^<]+)<\/guid>/i) ||
      []
    )[1]?.trim();
    const pubDate = (item.match(/<pubDate>([^<]+)<\/pubDate>/i) || [])[1]?.trim();
    const desc = decodeXml(
      (item.match(
        /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
      ) || [])[1] || "",
    );
    if (!title || !link || seen.has(link)) continue;
    seen.add(link);
    jobs.push({
      title: title.slice(0, 180),
      company: "unspecified",
      url: link,
      portal: "nodesk",
      location: "Remote",
      summary: stripHtml(desc).slice(0, 400),
      posted_at: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
      source_method: "rss",
    });
  }
  return jobs;
}

async function fetchDynamiteJobs(query: string): Promise<Job[]> {
  // Public listing page; fall back gracefully on shape changes
  const url = `https://dynamitejobs.com/remote-jobs?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const re =
    /href="(https:\/\/dynamitejobs\.com\/company\/[^"]+\/remote-job\/[^"]+)"[^>]*>\s*([^<]{3,120})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const title = decodeXml(m[2]).trim();
    if (!href || !title || seen.has(href)) continue;
    seen.add(href);
    jobs.push({
      title: title.slice(0, 180),
      company: "unspecified",
      url: href,
      portal: "dynamitejobs",
      location: "Remote",
      summary: "",
      posted_at: "",
      source_method: "html_list",
      query,
    });
    if (jobs.length >= 40) break;
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
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const re =
    /href="(\/jobsearch\/jobposting\/\d+[^"]*)"[^>]*>\s*([^<]{3,160})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    const title = decodeXml(m[2]).trim();
    const href = path.startsWith("http")
      ? path
      : `https://www.jobbank.gc.ca${path}`;
    if (!title || seen.has(href)) continue;
    seen.add(href);
    jobs.push({
      title: title.slice(0, 180),
      company: "unspecified",
      url: href.split("?")[0],
      portal: "jobbank_ca",
      location: loc,
      summary: "",
      posted_at: "",
      source_method: "html_list",
      query,
    });
    if (jobs.length >= 40) break;
  }
  return jobs;
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
    signal: AbortSignal.timeout(8_000),
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
      summary: stripHtml(String(r.snippet || r.description || "")).slice(0, 400),
      posted_at: String(r.updated || r.pubDate || "").slice(0, 10),
      source_method: "jooble_api",
      query,
    });
  }
  return jobs;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

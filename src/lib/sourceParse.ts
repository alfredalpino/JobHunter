/**
 * Pure parsing helpers for public job adapters (RSS / HTML list pages).
 * Kept free of network I/O so unit tests stay offline.
 */

export function decodeXml(s: string): string {
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Collapse double-encoded entities (&amp;amp; → &)
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

/** Loose query match: all tokens length>2, or full phrase. */
export function matchesQuery(blob: string, queries: string[]): boolean {
  const low = blob.toLowerCase();
  return queries.some((q) => {
    const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (!tokens.length) return low.includes(q.toLowerCase());
    return tokens.every((t) => low.includes(t)) || low.includes(q.toLowerCase());
  });
}

export type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
};

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const seen = new Set<string>();
  for (const item of xml.split(/<item[\s>]/i).slice(1)) {
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
      item.match(/<pubDate>([^<]+)<\/pubDate>/i) ||
      item.match(/<dc:date>([^<]+)<\/dc:date>/i) ||
      []
    )[1]?.trim();
    const description = decodeXml(
      (item.match(
        /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
      ) ||
        item.match(
          /<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i,
        ) ||
        [])[1] || "",
    );
    if (!title || !link || seen.has(link)) continue;
    seen.add(link);
    items.push({
      title,
      link,
      pubDate: pubDate || "",
      description,
    });
  }
  return items;
}

/** Normalize assorted date strings / unix epochs to ISO date or empty. */
export function normalizePostedAt(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

export type JobBankListing = {
  title: string;
  company: string;
  url: string;
  location: string;
  posted_at: string;
  summary: string;
};

/**
 * Parse Job Bank Canada search result HTML (article.resultJobItem blocks).
 */
export function parseJobBankHtml(
  html: string,
  fallbackLocation = "Canada",
): JobBankListing[] {
  const jobs: JobBankListing[] = [];
  const seen = new Set<string>();
  const articles = html.split(/<article\b/i).slice(1);
  for (const chunk of articles) {
    const hrefMatch =
      chunk.match(
        /href="(\/jobsearch\/jobposting\/\d+[^"]*)"/i,
      ) || chunk.match(/href="(https?:\/\/[^"]*jobposting\/\d+[^"]*)"/i);
    if (!hrefMatch) continue;
    let path = hrefMatch[1];
    // Drop jsessionid noise
    path = path.replace(/;jsessionid=[^"?]*/i, "");
    const href = path.startsWith("http")
      ? path.split("?")[0]
      : `https://www.jobbank.gc.ca${path.split("?")[0]}`;
    if (seen.has(href)) continue;

    const title = decodeXml(
      (chunk.match(/<span class="noctitle">\s*([\s\S]*?)<\/span>/i) ||
        [])[1] || "",
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!title || title.length < 3) continue;

    const company = decodeXml(
      (chunk.match(/<li class="business">\s*([\s\S]*?)<\/li>/i) || [])[1] ||
        "",
    )
      .replace(/\s+/g, " ")
      .trim();
    const locRaw = decodeXml(
      (chunk.match(/<li class="location">([\s\S]*?)<\/li>/i) || [])[1] || "",
    );
    const location =
      locRaw
        .replace(/<[^>]+>/g, " ")
        .replace(/Location/gi, "")
        .replace(/\s+/g, " ")
        .trim() || fallbackLocation;
    const dateRaw = decodeXml(
      (chunk.match(/<li class="date">\s*([\s\S]*?)<\/li>/i) || [])[1] || "",
    )
      .replace(/\s+/g, " ")
      .trim();
    const salary = decodeXml(
      (chunk.match(/<li class="salary">([\s\S]*?)<\/li>/i) || [])[1] || "",
    )
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    seen.add(href);
    jobs.push({
      title: title.slice(0, 180),
      company: (company || "unspecified").slice(0, 120),
      url: href,
      location: location.slice(0, 160),
      posted_at: normalizePostedAt(dateRaw),
      summary: salary.slice(0, 400),
    });
    if (jobs.length >= 40) break;
  }
  return jobs;
}

/** Map free-text query to a Jobicy tag (API is tag-based). */
export function jobicyTagFromQuery(query: string): string {
  const q = query.toLowerCase();
  if (/\b(devops|sre|platform)\b/.test(q)) return "devops";
  if (/\b(cloud|aws|azure|gcp)\b/.test(q)) return "cloud";
  if (/\b(security|soc|cyber)\b/.test(q)) return "security";
  if (/\b(support|help\s*desk|service\s*desk|desktop)\b/.test(q))
    return "support";
  if (/\b(data engineer|data analyst|business analyst|analytics)\b/.test(q))
    return "data";
  if (/\b(network|noc|sysadmin|administrator)\b/.test(q)) return "sysadmin";
  if (/\b(frontend|front-end|react|vue)\b/.test(q)) return "frontend";
  if (/\b(backend|back-end|api)\b/.test(q)) return "backend";
  if (/\b(full\s*stack|software|developer|engineer)\b/.test(q)) return "dev";
  const first = query.split(/\s+/).filter(Boolean)[0] || "dev";
  return first.toLowerCase().replace(/[^a-z0-9+-]/g, "") || "dev";
}

export function museCategoryForQuery(query: string): string {
  const q = query.toLowerCase();
  if (/\b(data|analyst|analytics|machine learning|ml)\b/.test(q)) {
    return "Data and Analytics";
  }
  if (/\b(software|developer|full\s*stack|backend|frontend)\b/.test(q)) {
    return "Software Engineer";
  }
  return "Computer and IT";
}

const ADZUNA_COUNTRY_MAP: Record<string, string> = {
  uae: "ae",
  dubai: "ae",
  usa: "us",
  washington: "us",
  india: "in",
  canada: "ca",
  alberta: "ca",
  poland: "pl",
  warsaw: "pl",
  uk: "gb",
  gb: "gb",
  remote: "us",
};

/**
 * Prefer ADZUNA_COUNTRIES env (comma-separated ISO codes), else map region
 * and expand remote packs across a few markets (capped).
 */
export function resolveAdzunaCountries(
  regionId: string,
  country: string,
  envCountries?: string,
): string[] {
  const fromEnv = (envCountries ?? process.env.ADZUNA_COUNTRIES ?? "")
    .split(/[,\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c));
  if (fromEnv.length) return [...new Set(fromEnv)].slice(0, 4);

  const primary =
    ADZUNA_COUNTRY_MAP[country] || ADZUNA_COUNTRY_MAP[regionId] || "us";
  const set = new Set<string>([primary]);
  if (regionId === "remote" || !regionId) {
    for (const c of ["us", "gb", "ae", "ca"]) set.add(c);
  } else if (regionId === "dubai" || country === "uae") {
    set.add("ae");
    set.add("gb");
  } else if (country === "canada" || regionId === "alberta") {
    set.add("ca");
  }
  return [...set].slice(0, 3);
}

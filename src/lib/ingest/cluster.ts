import { createHash, randomUUID } from "crypto";

/** Strip roman numerals / level suffixes for cross-portal title merge. */
export function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/[^\w\s+/.-]/g, " ")
    .replace(
      /\b(viii|vii|iii|ii|iv|ix|vi|x|v|sr|jr|1st|2nd|3rd)\.?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompany(company: string): string {
  return (company || "")
    .toLowerCase()
    .replace(/[^\w\s&.-]/g, " ")
    .replace(
      /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pvt|private)\b\.?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Host + path identity for hard-merge of the same apply URL. */
export function applyUrlIdentity(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}`;
  } catch {
    return (url || "").toLowerCase().trim();
  }
}

export function contentHash(summary: string, max = 400): string {
  const slice = (summary || "").replace(/\s+/g, " ").trim().slice(0, max);
  return createHash("sha256").update(slice).digest("hex").slice(0, 16);
}

export function clusterKey(
  title: string,
  company: string,
  summary?: string,
): string {
  const t = normalizeTitle(title);
  const c = normalizeCompany(company);
  const h = summary ? contentHash(summary) : "";
  return `${c}|${t}|${h.slice(0, 8)}`;
}

export type ClusterCandidate = {
  title: string;
  company: string;
  url: string;
  summary?: string;
  clusterId?: string | null;
};

/**
 * Decide whether two listings are the same opening.
 * Hard: identical apply host+path. Soft: same normalized company+title
 * (and matching content hash when both have summary).
 */
export function shouldMergeClusters(
  a: ClusterCandidate,
  b: ClusterCandidate,
): boolean {
  if (a.url && b.url && applyUrlIdentity(a.url) === applyUrlIdentity(b.url)) {
    return true;
  }
  const ta = normalizeTitle(a.title);
  const tb = normalizeTitle(b.title);
  const ca = normalizeCompany(a.company);
  const cb = normalizeCompany(b.company);
  if (!ta || !tb || !ca || !cb) return false;
  if (ta !== tb || ca !== cb) return false;
  if (a.summary && b.summary) {
    return contentHash(a.summary) === contentHash(b.summary);
  }
  return true;
}

export function newClusterId(): string {
  return randomUUID();
}

export function newJobId(): string {
  return randomUUID();
}

export function newIngestRunId(): string {
  return randomUUID();
}

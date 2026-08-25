/**
 * Build a job summary for scoring that does not drop experience requirements
 * buried late in long postings (e.g. Qualifications after 2k chars of duties).
 */

const YEAR_WINDOW =
  /(?:^|[.!?•|\n]\s*)([^.!?\n|]{0,100}?(?:\d+\s*\+?\s*years?|\d+\s*[-–—]\s*\d+\s*years?|(?:minimum|at\s+least)\s+(?:of\s+)?\d+\s*\+?\s*years?)[^.!?\n|]{0,120})/gi;

export function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefer keeping year-requirement snippets, then the head of the posting.
 * Default 1800 chars — enough for scoring, still trimmed again in API response.
 */
export function clipJobSummary(raw: string, max = 1800): string {
  const t = stripHtml(raw);
  if (!t) return "";
  if (t.length <= max) return t;

  const yearBits: string[] = [];
  for (const m of t.matchAll(YEAR_WINDOW)) {
    const bit = (m[1] || m[0] || "").replace(/\s+/g, " ").trim();
    if (bit.length >= 12) yearBits.push(bit);
  }
  const uniqYears = [...new Set(yearBits)].slice(0, 4);
  const prefix = uniqYears.join(" · ").slice(0, 500);
  if (!prefix) return t.slice(0, max);

  const sep = " | ";
  const budget = Math.max(200, max - prefix.length - sep.length);
  return `${prefix}${sep}${t.slice(0, budget)}`.slice(0, max);
}

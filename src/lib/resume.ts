import { detectProfileFamilies, mustMatchFromTitles, ROLE_FAMILIES } from "./roleFamilies";
import { buildHuntQueries } from "./huntQueries";
import type { Profile } from "./types";

const CERT_PATTERNS: [RegExp, string][] = [
  [/\bccna\b/i, "CCNA"],
  [/\bccnp\b/i, "CCNP"],
  [/\bccie\b/i, "CCIE"],
  [/\bcomptia\s*security\+?/i, "CompTIA Security+"],
  [/\bsecurity\+/i, "CompTIA Security+"],
  [/\bcomptia\s*network\+?/i, "CompTIA Network+"],
  [/\bnetwork\+/i, "CompTIA Network+"],
  [/\baz[- ]?104\b/i, "AZ-104"],
  [/\baz[- ]?900\b/i, "AZ-900"],
  [/\baws\s+certified/i, "AWS Certified"],
  [/\bsolutions?\s+architect/i, "AWS Solutions Architect"],
  [/\bcka\b/i, "CKA"],
  [/\bckad\b/i, "CKAD"],
  [/\bpmp\b/i, "PMP"],
  [/\bitil\b/i, "ITIL"],
  [/\bgoogle\s+it\s+support\b/i, "Google IT Support"],
  [/\bcfa\b/i, "CFA"],
  [/\bcpa\b/i, "CPA"],
  [/\bscrum\s*master\b/i, "Scrum Master"],
  [/\bcsm\b/i, "CSM"],
  [/\bhcip\b/i, "HCIP"],
  [/\bjuniper\b/i, "Juniper"],
];

const SKILL_SEEDS = [
  "network",
  "cisco",
  "ccna",
  "vlan",
  "ospf",
  "bgp",
  "firewall",
  "vpn",
  "noc",
  "routing",
  "switching",
  "tcp/ip",
  "dns",
  "dhcp",
  "azure",
  "aws",
  "gcp",
  "linux",
  "windows server",
  "active directory",
  "python",
  "javascript",
  "typescript",
  "react",
  "node.js",
  "next.js",
  "troubleshooting",
  "helpdesk",
  "service desk",
  "it support",
  "security",
  "cybersecurity",
  "cloud",
  "devops",
  "terraform",
  "ansible",
  "sql",
  "postgresql",
  "mongodb",
  "kubernetes",
  "docker",
  "excel",
  "tableau",
  "power bi",
  "figma",
  "salesforce",
  "marketing",
  "seo",
  "content",
  "accounting",
  "finance",
  "hr",
  "recruiting",
  "customer success",
  "product management",
  "agile",
  "scrum",
  "java",
  "golang",
  "machine learning",
  "data analysis",
  "data engineering",
  "splunk",
  "wireshark",
  "vmware",
  "hyper-v",
  "sap",
  "oracle",
  "jira",
  "servicenow",
];

const SKILL_SEEDS_SORTED = [...SKILL_SEEDS].sort((a, b) => b.length - a.length);

const SUMMARY_SECTION =
  /^(?:#{1,3}\s*)?(?:professional\s+)?summary|profile summary|about me|career summary|objective/i;

const TITLE_ROLE =
  /\b(engineer|analyst|administrator|support|noc|network|developer|specialist|manager|designer|accountant|recruiter|marketer|consultant|coordinator|associate|scientist|architect|technician|operator|executive|director|lead|intern)\b/i;

/** Early-career / non-target roles — never hunt or match on these when a professional track exists. */
const NON_PROFESSIONAL_TITLE =
  /\b(janitor|janitorial|custodian|cleaner|cleaning|housekeeping|housekeeper|sanitation|garbage|landscap|lawn care|mowing|dishwasher|busboy|barista|cashier|retail clerk|store clerk|stock clerk|warehouse picker|warehouse packer|delivery driver|food delivery|taxi driver|uber driver|security guard|door guard|receptionist|front desk clerk|fast food|fast-food|waiter|waitress|server\b|hostess|bartender|nanny|babysit|dog walker|farm hand|farmhand|construction labor|general labor|manual labor|laborer|mover\b|parking attendant|valet|car wash|prep cook|line cook|kitchen helper|hotel housekeeping|room attendant|porter\b|groundskeeper|sanitation worker|trash collector|forklift operator|production worker|factory worker|assembly line|call center(?: agent)?(?!\s*(?: engineer| analyst| manager)))\b/i;

const EXPERIENCE_SECTION_END =
  /^(?:#{1,3}\s*)?(?:education|skills|certification|projects|summary|references|languages)/i;

export type ExperienceEntry = {
  title: string;
  startYear: number | null;
  endYear: number | null;
  isPresent: boolean;
};

const EXPERIENCE_SECTION =
  /^(?:#{1,3}\s*)?(?:professional\s+)?experience|work\s+history|employment|career\s+history|relevant\s+experience/i;
const SKILLS_SECTION =
  /^(?:#{1,3}\s*)?(?:technical\s+)?skills|core\s+competencies|technologies|tools\s*&\s*technologies/i;

const LOCATION_TO_REGION: [string, string][] = [
  ["dubai", "dubai"],
  ["abu dhabi", "dubai"],
  ["sharjah", "dubai"],
  ["uae", "dubai"],
  ["united arab emirates", "dubai"],
  ["bangalore", "bangalore"],
  ["bengaluru", "bangalore"],
  ["lucknow", "lucknow"],
  ["hyderabad", "india"],
  ["mumbai", "india"],
  ["pune", "india"],
  ["delhi", "india"],
  ["noida", "india"],
  ["chennai", "india"],
  ["india", "india"],
  ["seattle", "washington"],
  ["bellevue", "washington"],
  ["redmond", "washington"],
  ["washington", "washington"],
  ["alberta", "alberta"],
  ["calgary", "alberta"],
  ["edmonton", "alberta"],
  ["canada", "alberta"],
  ["warsaw", "warsaw"],
  ["poland", "warsaw"],
  ["united states", "usa"],
  ["usa", "usa"],
  ["u.s.", "usa"],
];

/** Map resume location text → region pack id for default prefs. */
export function guessRegionFromLocation(location: string): string {
  const blob = location.toLowerCase();
  for (const [needle, region] of LOCATION_TO_REGION) {
    if (blob.includes(needle)) return region;
  }
  if (/\bremote\b|\bworldwide\b|\bwfh\b/.test(blob)) return "remote";
  return "dubai";
}

export function analyzeResumeText(text: string, displayName = ""): Profile {
  const clean = text.replace(/[ \t]+/g, " ");
  const lines = clean
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean);
  const blob = clean.toLowerCase();

  const name = extractName(lines, displayName);
  const openTo = extractOpenToRoles(text);
  const experienceEntries = extractExperienceEntries(lines);

  const sectionSkills = extractSkillsSection(lines);
  const seedSkills = matchSkillSeeds(blob);
  const skills = dedupe([...sectionSkills, ...seedSkills]);
  const headline = extractHeadline(lines, name);

  const { targetTitles: careerTitles, searchQueries } =
    selectCareerRelevantTitles({
      entries: experienceEntries,
      openTo,
      headline,
      skills,
    });

  const targetTitles = careerTitles
    .filter((t) => t.length <= 60 && !/\b(supported founders|with data tracking)\b/i.test(t))
    .slice(0, 8);

  const certs = CERT_PATTERNS.filter(([pat]) => pat.test(blob)).map(
    ([, label]) => label,
  );

  const years = estimateYears(blob);
  const juniorSignal = detectJuniorSignal(blob, openTo);
  const level =
    juniorSignal || (years != null && years <= 3)
      ? "junior_entry_associate"
      : years != null && years >= 8
        ? "senior"
        : "mid_or_unknown";

  const maxJobLevel = inferMaxJobLevel(blob, years, targetTitles);
  const maxYearsRequired =
    maxJobLevel === "junior" || juniorSignal || years == null || years <= 2
      ? 2
      : years != null && years <= 3
        ? 3
        : maxJobLevel === "senior"
          ? 8
          : Math.min(Math.floor(years ?? 4) + 1, 8);

  const finalTitles =
    targetTitles.length > 0 ? targetTitles : fallbackTitlesFromSkills(skills);

  const email = extractEmail(text);
  const phone = extractPhone(text);
  const linkedinM = text.match(
    /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w%-]+\/?)/i,
  );
  const githubM = text.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i,
  );
  const portfolioM = text.match(
    /(https?:\/\/[\w.-]+\.(?:dev|me|io|app|vercel\.app)[^\s]*)/i,
  );

  const location = guessLocation(blob);
  const workAuth = extractWorkAuth(blob);
  const plainSummary = extractSummary(lines);
  const titleMust = mustMatchFromTitles(finalTitles);

  const projectCred = Boolean(
    /\b(project|portfolio|github|capstone|built|deployed|open\s*source|implemented|designed)\b/i.test(
      blob,
    ),
  );

  const profile: Profile = {
    source: "resume",
    candidate: {
      name: name || "Aspirant",
      email,
      phone,
      linkedin: linkedinM?.[1] || "",
      github: githubM?.[0]?.startsWith("http")
        ? githubM[0]
        : githubM?.[0]
          ? `https://${githubM[0].replace(/^\/\//, "")}`
          : "",
      portfolio: portfolioM?.[1] || "",
      location,
      work_auth: workAuth,
    },
    experience: {
      estimated_years: years,
      max_years_required: maxYearsRequired,
      level,
      target_band: maxYearsRequired <= 3 ? "0-3" : `0-${maxYearsRequired}`,
      credibility:
        projectCred || Boolean(certs.length) || (years != null && years >= 2),
      max_job_level: maxJobLevel,
      seniority_band: maxJobLevel === "executive" ? "executive" : maxJobLevel,
    },
    target_titles: finalTitles,
    search_queries: searchQueries.length
      ? searchQueries
      : dedupe(finalTitles.filter(isHuntWorthyTitle)).slice(0, 3),
    skills_positive: dedupe([...skills, ...certs.map((c) => c.toLowerCase())]),
    certifications: certs,
    title_must_match_any: titleMust.length
      ? titleMust
      : titleMustFromSkills(skills, finalTitles),
    plain_summary: plainSummary || headline,
    raw_excerpt: text.slice(0, 2500),
  };
  profile.search_queries = buildHuntQueries(profile).slice(0, 6);
  return profile;
}

/** Longest phrases first — avoids partial token false positives. */
export function matchSkillSeeds(blob: string): string[] {
  const found: string[] = [];
  for (const seed of SKILL_SEEDS_SORTED) {
    if (blob.includes(seed)) found.push(seed);
  }
  return found;
}

/** First role-like headline line after the name block. */
export function extractHeadline(lines: string[], name: string): string {
  const nameLow = name.toLowerCase();
  for (const ln of lines.slice(0, 16)) {
    const low = ln.toLowerCase();
    if (low === nameLow || /@|http|phone|tel:|\+?\d{8,}/.test(low)) continue;
    if (TITLE_ROLE.test(ln) && ln.length <= 72) return ln.trim();
  }
  return "";
}

/** Pull 1–3 sentences from summary / objective section. */
export function extractSummary(lines: string[]): string {
  const chunks: string[] = [];
  let inSummary = false;
  for (const ln of lines) {
    if (SUMMARY_SECTION.test(ln)) {
      inSummary = true;
      continue;
    }
    if (
      inSummary &&
      /^(?:#{1,3}\s*)?(?:experience|education|skills|certification|work)/i.test(
        ln,
      )
    ) {
      break;
    }
    if (!inSummary) continue;
    const t = ln.replace(/^[-*•]\s*/, "").trim();
    if (t.length >= 20 && t.length <= 400) chunks.push(t);
    if (chunks.join(" ").length > 320) break;
  }
  return chunks.join(" ").slice(0, 400);
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

const EMAIL_CANDIDATE =
  /([A-Za-z0-9][A-Za-z0-9._+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/gi;

/** Phone digits sometimes glue to the local part — strip before @. */
const PHONE_GLUED_EMAIL =
  /\d{7,}([A-Za-z][A-Za-z0-9._+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})/gi;

export function sanitizeEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed.toLowerCase();
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase().replace(/[^\w.-]/g, "");
  local = local.replace(/^\d{7,}/, "");
  local = local.replace(/[^\w.+-]/g, "");
  return `${local.toLowerCase()}@${domain}`;
}

export function isPlausibleEmail(email: string): boolean {
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (!/[a-z]/.test(local)) return false;
  const digits = (local.match(/\d/g) || []).length;
  if (digits >= 8 && digits > local.length * 0.55) return false;
  if (/^\d+$/.test(local)) return false;
  return true;
}

function scoreEmailCandidate(email: string): number {
  const [local, domain] = email.split("@");
  let score = 0;
  if (/^[a-z]/.test(local)) score += 4;
  if ((local.match(/\d/g) || []).length <= 4) score += 3;
  if (/^(gmail|outlook|yahoo|hotmail|icloud|protonmail)\./.test(domain)) {
    score += 2;
  }
  if (local.length >= 3 && local.length <= 48) score += 1;
  if (/^\d/.test(local)) score -= 4;
  return score;
}

/** Robust email extraction — never keep a glued phone prefix in the local part. */
export function extractEmail(text: string): string {
  const candidates = new Set<string>();

  for (const m of text.matchAll(EMAIL_CANDIDATE)) {
    candidates.add(sanitizeEmailAddress(m[1]));
  }
  for (const m of text.matchAll(PHONE_GLUED_EMAIL)) {
    candidates.add(sanitizeEmailAddress(m[1]));
  }

  let best = "";
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!isPlausibleEmail(c)) continue;
    const score = scoreEmailCandidate(c);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** Extract phone — recover digits glued before email, then scan remaining text. */
export function extractPhone(text: string): string {
  // Phone often appears glued before the email local part on one line
  for (const m of text.matchAll(PHONE_GLUED_EMAIL)) {
    const prefix = m[0].match(/^(\d{7,})/);
    if (prefix) {
      const digits = prefix[1];
      if (digits.length >= 10 && digits.length <= 12) {
        return formatPhoneHint(text, m.index ?? 0, digits);
      }
    }
  }

  // Strip emails but leave any digit prefix that was glued to the address
  const withoutEmails = text.replace(EMAIL_CANDIDATE, (match) => {
    const prefix = match.match(/^(\d{7,})/);
    return prefix ? ` ${prefix[1]} ` : " ";
  });

  const patterns = [
    /\+\d{1,3}[\s.-]*\d{7,12}/,
    /(?:tel|phone|mobile|mob)[:\s]*\+?\d[\d\s\-().]{8,}\d/i,
    /(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{4,}/,
    /\b\d{10}\b/,
    /\+?\d[\d\s\-()]{8,}\d/,
  ];

  for (const re of patterns) {
    const m = withoutEmails.match(re);
    if (m?.[0]) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        return normalizePhone(m[0]);
      }
    }
  }
  return "";
}

/** Prefer country code near the match when present (+91, +971, etc.). */
function formatPhoneHint(text: string, index: number, digits: string): string {
  const window = text.slice(Math.max(0, index - 12), index + digits.length + 4);
  const cc = window.match(/(\+\d{1,3})[\s.-]*\d*$/);
  if (cc) return normalizePhone(`${cc[1]}-${digits}`);
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return normalizePhone(`+91-${digits}`);
  }
  return normalizePhone(digits);
}

function extractName(lines: string[], displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed) return trimmed;

  for (const ln of lines.slice(0, 14)) {
    const low = ln.toLowerCase();
    if (
      /@|http|linkedin|github|phone|tel:|\+?\d{8,}|summary|experience|education|skills|certification|objective|profile/.test(
        low,
      )
    ) {
      continue;
    }
    const candidate = ln.split(/[·|]/)[0].replace(/^[#*\s]+/, "").trim();
    const words = candidate.split(/\s+/);
    if (words.length < 2 || words.length > 6 || !/[A-Za-z]/.test(candidate)) {
      continue;
    }
    if (
      candidate === candidate.toUpperCase() ||
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$/.test(candidate)
    ) {
      return candidate === candidate.toUpperCase()
        ? titleCase(candidate)
        : candidate;
    }
    if (!trimmed) return candidate;
  }
  return trimmed;
}

function extractOpenToRoles(text: string): string[] {
  const openTo: string[] = [];
  for (const m of text.matchAll(/(?:open to)[:\s]+(.+)/gi)) {
    for (const part of m[1].split(/[·|,;/]/)) {
      const p = part.trim().replace(/^[.\-*]+|[.\-*]+$/g, "");
      if (
        p.length > 3 &&
        p.length < 60 &&
        TITLE_ROLE.test(p) &&
        !/\b(supported|with data|during|including|assisted)\b/i.test(p)
      ) {
        openTo.push(p);
      }
    }
  }
  return openTo;
}

/** Titles from Experience section blocks (Company — Title, Title at Company, etc.). */
export function extractExperienceTitles(lines: string[]): string[] {
  return extractExperienceEntries(lines).map((e) => e.title);
}

/** Parse experience blocks with dates, most-recent first. */
export function extractExperienceEntries(lines: string[]): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  let inExperience = false;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (EXPERIENCE_SECTION.test(ln)) {
      inExperience = true;
      continue;
    }
    if (inExperience && EXPERIENCE_SECTION_END.test(ln)) {
      inExperience = false;
      continue;
    }
    if (!inExperience) continue;

    const datesOnLine = parseDateRange(ln);
    const titleOnLine = parseJobTitleLine(ln);

    if (titleOnLine && datesOnLine) {
      entries.push({ title: titleOnLine, ...datesOnLine });
      continue;
    }

    if (titleOnLine) {
      const nextDates = i + 1 < lines.length ? parseDateRange(lines[i + 1]) : null;
      if (nextDates) {
        entries.push({ title: titleOnLine, ...nextDates });
        i += 1;
        continue;
      }
      entries.push({
        title: titleOnLine,
        startYear: null,
        endYear: null,
        isPresent: false,
      });
      continue;
    }

    if (datesOnLine && i + 1 < lines.length) {
      const nextTitle = parseJobTitleLine(lines[i + 1]);
      if (nextTitle) {
        entries.push({ title: nextTitle, ...datesOnLine });
        i += 1;
      }
    }
  }

  return sortExperienceByRecency(entries);
}

function parseDateRange(
  ln: string,
): Pick<ExperienceEntry, "startYear" | "endYear" | "isPresent"> | null {
  if (!/20\d{2}|present|current|now/i.test(ln)) return null;
  const years = [...ln.matchAll(/20\d{2}/g)].map((m) => +m[0]);
  const isPresent = /\b(present|current|now)\b/i.test(ln);
  if (!years.length) return null;
  if (years.length === 1) {
    return {
      startYear: years[0],
      endYear: isPresent ? null : years[0],
      isPresent,
    };
  }
  return {
    startYear: years[0],
    endYear: isPresent ? null : years[years.length - 1],
    isPresent,
  };
}

export function sortExperienceByRecency(
  entries: ExperienceEntry[],
): ExperienceEntry[] {
  return [...entries].sort((a, b) => {
    const endA = a.isPresent ? 9999 : (a.endYear ?? a.startYear ?? 0);
    const endB = b.isPresent ? 9999 : (b.endYear ?? b.startYear ?? 0);
    if (endB !== endA) return endB - endA;
    return (b.startYear ?? 0) - (a.startYear ?? 0);
  });
}

export function isNonProfessionalTitle(title: string): boolean {
  return NON_PROFESSIONAL_TITLE.test(title);
}

export function isHuntWorthyTitle(title: string): boolean {
  return (
    TITLE_ROLE.test(title) &&
    !isNonProfessionalTitle(title) &&
    !/waiter|chef|driver|cashier|student\b/i.test(title)
  );
}

/** Strip level suffixes so "Software Engineer II" searches as "Software Engineer". */
export function normalizeSearchQuery(title: string): string {
  return title
    .replace(
      /\s+(?:I{1,3}|IV|V|VI|[1-9]|1st|2nd|3rd|4th|level\s*[1-9])\s*$/i,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detectTitleFamilies(title: string): import("./roleFamilies").RoleFamilyId[] {
  const blob = title.toLowerCase();
  const hits: import("./roleFamilies").RoleFamilyId[] = [];
  for (const fam of ROLE_FAMILIES) {
    if (fam.phrases.some((ph) => blob.includes(ph.toLowerCase()))) {
      hits.push(fam.id);
    }
  }
  return hits;
}

function titlesShareCareerTrack(a: string, b: string): boolean {
  const famA = detectTitleFamilies(a);
  const famB = detectTitleFamilies(b);
  if (!famA.length || !famB.length) {
    const tokensA = a.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const tokensB = b.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    return tokensA.some((t) => tokensB.includes(t));
  }
  return famA.some((f) => famB.includes(f));
}

/**
 * Pick titles for matching vs hunt queries using recent career trajectory only.
 * Drops early unrelated jobs (e.g. janitor) when the latest role is software engineering.
 */
export function selectCareerRelevantTitles(input: {
  entries: ExperienceEntry[];
  openTo: string[];
  headline: string;
  skills: string[];
}): { targetTitles: string[]; searchQueries: string[] } {
  const { entries, openTo, headline, skills } = input;
  const sorted = sortExperienceByRecency(entries);

  const professional = sorted.filter(
    (e) => isHuntWorthyTitle(e.title) && !isNonProfessionalTitle(e.title),
  );
  const anchorEntry = professional[0] ?? sorted[0];
  const anchorTitle =
    anchorEntry?.title ||
    (headline && isHuntWorthyTitle(headline) ? headline : "") ||
    "";

  const openToClean = dedupe(
    openTo.filter((t) => isHuntWorthyTitle(t) && !isNonProfessionalTitle(t)),
  );

  const recentCoherent = (professional.length ? professional : sorted)
    .filter((e) => {
      if (isNonProfessionalTitle(e.title) || !isHuntWorthyTitle(e.title)) {
        return false;
      }
      if (!anchorTitle) return true;
      return titlesShareCareerTrack(e.title, anchorTitle);
    })
    .slice(0, 3)
    .map((e) => e.title);

  const targetTitles = dedupe([
    ...openToClean,
    ...(headline && isHuntWorthyTitle(headline) ? [headline] : []),
    ...recentCoherent,
  ]).slice(0, 6);

  let searchQueries: string[];
  if (openToClean.length) {
    searchQueries = openToClean.slice(0, 3).map(normalizeSearchQuery);
  } else if (headline && isHuntWorthyTitle(headline)) {
    searchQueries = [normalizeSearchQuery(headline)];
  } else if (recentCoherent.length) {
    searchQueries = recentCoherent.slice(0, 2).map(normalizeSearchQuery);
  } else if (targetTitles.length) {
    searchQueries = targetTitles.slice(0, 2).map(normalizeSearchQuery);
  } else {
    const fallback = fallbackTitlesFromSkills(skills);
    searchQueries = fallback.slice(0, 2).map(normalizeSearchQuery);
  }

  searchQueries = dedupe(searchQueries.filter(Boolean)).slice(0, 3);

  return {
    targetTitles: targetTitles.length
      ? targetTitles
      : fallbackTitlesFromSkills(skills).slice(0, 3),
    searchQueries,
  };
}

function parseJobTitleLine(ln: string): string | null {
  const cleaned = ln.replace(/^[#*\s•-]+/, "").replace(/\*+/g, "").trim();
  if (cleaned.length < 4 || cleaned.length > 72) return null;
  if (isNonProfessionalTitle(cleaned)) return null;
  if (/^[-*•]/.test(ln.trim())) return null;
  if (
    /^(?:20\d{2}|present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b)/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (
    /\b(managed|implemented|developed|assisted|supported|responsible|escalation|monitoring|configured|maintained|led team)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }

  // Prefer em dash, pipe, comma, " at " — avoid splitting hyphenated titles (Full-Stack)
  const separators = cleaned.split(/\s*(?:—|–|·|\||,|\s+at\s+)\s*/i);
  const roleParts: string[] = [];
  for (const part of separators) {
    const t = part.trim();
    if (
      t.length >= 4 &&
      t.length <= 60 &&
      TITLE_ROLE.test(t) &&
      /^[A-Z]/.test(t) &&
      !isCompanyFragment(t)
    ) {
      roleParts.push(t);
    }
  }
  if (roleParts.length) {
    return roleParts.sort((a, b) => b.length - a.length)[0];
  }

  if (
    TITLE_ROLE.test(cleaned) &&
    /^[A-Z]/.test(cleaned) &&
    !/\b(university|college|institute|school)\b/i.test(cleaned) &&
    !isCompanyFragment(cleaned) &&
    cleaned.split(/\s+/).length <= 8
  ) {
    return cleaned;
  }
  return null;
}

/** Company name fragment — not a job title on its own. */
function isCompanyFragment(part: string): boolean {
  const t = part.trim();
  if (TITLE_ROLE.test(t) && /\b(engineer|administrator|developer|analyst|manager|specialist|technician|architect|consultant)\b/i.test(t)) {
    return false;
  }
  return /\b(inc|llc|ltd|corp|company|technologies|telecom|group|holdings)\b/i.test(t);
}

function extractInlineTitles(text: string): string[] {
  const titles: string[] = [];
  for (const m of text.matchAll(
    /^(?:#{1,3}\s*)?\*{0,2}([A-Z][A-Za-z0-9 /&+.-]{3,60})\*{0,2}\s*(?:·|-|,|\||$)/gm,
  )) {
    const t = m[1].replace(/\*+/g, "").trim();
    if (TITLE_ROLE.test(t)) titles.push(t);
  }
  return titles;
}

/** Parse bullet list under Skills / Technical Skills heading. */
export function extractSkillsSection(lines: string[]): string[] {
  const skills: string[] = [];
  let inSkills = false;

  for (const ln of lines) {
    if (SKILLS_SECTION.test(ln)) {
      inSkills = true;
      continue;
    }
    if (
      inSkills &&
      /^(?:#{1,3}\s*)?(?:experience|education|certification|projects|summary|work)/i.test(
        ln,
      )
    ) {
      break;
    }
    if (!inSkills) continue;

    const chunk = ln.replace(/^[-*•]\s*/, "").trim();
    if (!chunk || chunk.length > 120) continue;

    for (const part of chunk.split(/[,;|·/]/)) {
      const s = part.trim().toLowerCase();
      if (s.length >= 2 && s.length <= 40 && !/^(and|or|etc)\.?$/.test(s)) {
        skills.push(s);
      }
    }
  }
  return skills;
}

export function inferMaxJobLevel(
  blob: string,
  years: number | null,
  titles: string[],
): string {
  const titleBlob = titles.join(" ").toLowerCase();

  if (
    /\b(intern|internship|trainee|apprentice|graduate|fresher|entry[\s-]?level|junior|jr\.?|associate)\b/.test(
      blob,
    ) ||
    /\b(intern|junior|associate|entry)\b/.test(titleBlob)
  ) {
    return "junior";
  }
  if (
    /\b(director|head of|vice president|\bvp\b|chief|cto|cio|ceo|cfo|coo|executive|managing director)\b/.test(
      blob,
    ) ||
    /\b(director|head of|vp|chief)\b/.test(titleBlob)
  ) {
    return "executive";
  }
  if (
    /\b(team lead|tech lead|engineering manager|engineering lead|manager)\b/.test(
      blob,
    ) ||
    /\b(lead|manager)\b/.test(titleBlob)
  ) {
    return "lead";
  }
  if (
    /\b(senior|sr\.?|staff|principal|architect)\b/.test(blob) ||
    /\b(senior|staff|principal)\b/.test(titleBlob) ||
    (years != null && years >= 8)
  ) {
    return "senior";
  }
  if (years != null && years >= 4) return "mid";
  return "junior";
}

function detectJuniorSignal(blob: string, openTo: string[]): boolean {
  return Boolean(
    openTo.length ||
      /\b(junior|entry[\s-]?level|fresher|associate|intern|noc l1|graduate|new grad)\b/i.test(
        blob,
      ),
  );
}

function extractWorkAuth(blob: string): string {
  if (/\b(uae|gcc|dubai)\s+(national|citizen|passport)\b/.test(blob)) {
    return "uae_national";
  }
  if (/\b(us citizen|american citizen|green card)\b/.test(blob)) {
    return "us_citizen";
  }
  if (/\b(visa sponsorship|require[s]? sponsorship|sponsor(ship)? required)\b/.test(blob)) {
    return "needs_sponsorship";
  }
  if (/\b(valid (uae|us|uk|canada|schengen) visa|work permit|employment visa)\b/.test(blob)) {
    return "has_work_visa";
  }
  if (/\b(eligible to work|authorized to work|right to work)\b/.test(blob)) {
    return "authorized";
  }
  return "";
}

export function estimateYears(blob: string): number | null {
  const spans = [
    ...blob.matchAll(/(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)/gi),
  ];
  if (!spans.length) {
    const m = blob.match(
      /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp\.?)/,
    );
    return m ? parseFloat(m[1]) : null;
  }
  let total = 0;
  const yearNow = new Date().getUTCFullYear();
  for (const [, start, end] of spans) {
    const y0 = +start;
    const y1 = /present|current|now/i.test(end) ? yearNow : +end;
    if (y1 >= y0) total += Math.max(0, y1 - y0);
  }
  return total ? Math.round(Math.min(total, 15) * 10) / 10 : null;
}

function guessLocation(blob: string): string {
  const places: [string, string][] = [
    ["bangalore", "Bangalore"],
    ["bengaluru", "Bengaluru"],
    ["lucknow", "Lucknow"],
    ["hyderabad", "Hyderabad"],
    ["mumbai", "Mumbai"],
    ["pune", "Pune"],
    ["delhi", "Delhi"],
    ["noida", "Noida"],
    ["chennai", "Chennai"],
    ["dubai", "Dubai"],
    ["abu dhabi", "Abu Dhabi"],
    ["sharjah", "Sharjah"],
    ["uae", "UAE"],
    ["riyadh", "Riyadh"],
    ["jeddah", "Jeddah"],
    ["warsaw", "Warsaw"],
    ["krakow", "Kraków"],
    ["alberta", "Alberta"],
    ["calgary", "Calgary"],
    ["toronto", "Toronto"],
    ["seattle", "Seattle"],
    ["new york", "New York"],
    ["san francisco", "San Francisco"],
    ["india", "India"],
    ["canada", "Canada"],
    ["poland", "Poland"],
    ["united states", "United States"],
    ["usa", "USA"],
    ["remote", "Remote"],
  ];
  for (const [needle, label] of places) {
    if (blob.includes(needle)) return label;
  }
  return "";
}

function fallbackTitlesFromSkills(skills: string[]): string[] {
  const blob = skills.join(" ").toLowerCase();
  const families = detectProfileFamilies({
    target_titles: [],
    skills_positive: skills,
  });

  const byFamily: Record<string, string[]> = {
    network_ops: ["Network Engineer", "NOC Engineer", "Network Administrator"],
    it_support: ["IT Support Engineer", "Help Desk Technician", "Systems Administrator"],
    software_eng: ["Software Engineer", "Full Stack Developer", "Backend Developer"],
    cloud_devops: ["Cloud Engineer", "DevOps Engineer", "Site Reliability Engineer"],
    security: ["Security Analyst", "Cybersecurity Engineer"],
    data_analyst: ["Data Analyst", "Business Analyst"],
    product_design: ["Product Designer", "UX Designer"],
    general_analyst: ["Analyst", "Operations Analyst"],
  };

  for (const id of families) {
    const titles = byFamily[id];
    if (titles) return titles;
  }

  if (/network|cisco|noc|routing|switching/.test(blob)) {
    return ["Network Engineer", "NOC Engineer"];
  }
  if (/react|javascript|typescript|python|java|developer/.test(blob)) {
    return ["Software Engineer", "Developer"];
  }
  if (/support|helpdesk|service desk/.test(blob)) {
    return ["IT Support Engineer", "Help Desk Technician"];
  }
  return ["IT Support Engineer", "Analyst", "Associate"];
}

function titleMustFromSkills(skills: string[], titles: string[]): string[] {
  const must: string[] = [];
  const blob = [...skills, ...titles.map((t) => t.toLowerCase())].join(" ");
  for (const token of [
    "network",
    "noc",
    "cisco",
    "it support",
    "infrastructure",
    "helpdesk",
    "service desk",
    "systems admin",
    "security",
    "cloud",
    "devops",
    "data",
    "analyst",
    "developer",
    "react",
    "python",
  ]) {
    if (blob.includes(token)) must.push(token);
  }
  return must.length
    ? must
    : ["network", "noc", "it support", "engineer", "developer"];
}

export function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

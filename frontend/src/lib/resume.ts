import { mustMatchFromTitles } from "./roleFamilies";
import type { Profile } from "./types";

const CERT_PATTERNS: [RegExp, string][] = [
  [/\bccna\b/i, "CCNA"],
  [/\bccnp\b/i, "CCNP"],
  [/\bcomptia\s*security\+?/i, "CompTIA Security+"],
  [/\bsecurity\+/i, "CompTIA Security+"],
  [/\baz[- ]?104\b/i, "AZ-104"],
  [/\baws\s+certified\b/i, "AWS Certified"],
  [/\bpmp\b/i, "PMP"],
  [/\bitil\b/i, "ITIL"],
  [/\bgoogle\s+it\s+support\b/i, "Google IT Support"],
  [/\bcfa\b/i, "CFA"],
  [/\bcpa\b/i, "CPA"],
  [/\bscrum\s*master\b/i, "Scrum Master"],
];

const SKILL_SEEDS = [
  "network",
  "cisco",
  "ccna",
  "vlan",
  "ospf",
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
  "linux",
  "python",
  "javascript",
  "typescript",
  "react",
  "troubleshooting",
  "helpdesk",
  "service desk",
  "it support",
  "security",
  "cloud",
  "devops",
  "sql",
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
];

export function analyzeResumeText(text: string, displayName = ""): Profile {
  const clean = text.replace(/[ \t]+/g, " ");
  const lines = clean
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean);
  const blob = clean.toLowerCase();

  let name = displayName.trim();
  if (!name) {
    for (const ln of lines.slice(0, 12)) {
      const low = ln.toLowerCase();
      if (
        /@|http|linkedin|github|phone|\+?\d{8,}|summary|experience|education|skills|certification/.test(
          low,
        )
      ) {
        continue;
      }
      const candidate = ln.split(/[·|]/)[0].replace(/^[#*\s]+/, "").trim();
      if (
        candidate.split(/\s+/).length > 1 &&
        candidate.split(/\s+/).length <= 6 &&
        /[A-Za-z]/.test(candidate)
      ) {
        if (
          candidate === candidate.toUpperCase() ||
          /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$/.test(candidate)
        ) {
          name =
            candidate === candidate.toUpperCase()
              ? titleCase(candidate)
              : candidate;
          break;
        }
        if (!name) name = candidate;
      }
    }
  }

  const openTo: string[] = [];
  for (const m of text.matchAll(/(?:open to)[:\s]+(.+)/gi)) {
    for (const part of m[1].split(/[·|,;/]/)) {
      const p = part.trim().replace(/^[.\-*]+|[.\-*]+$/g, "");
      if (p.length > 3 && p.length < 60) openTo.push(p);
    }
  }

  const titles: string[] = [];
  for (const m of text.matchAll(
    /^(?:#{1,3}\s*)?\*{0,2}([A-Z][A-Za-z0-9 /&+.-]{3,60})\*{0,2}\s*(?:·|-|,|\||$)/gm,
  )) {
    const t = m[1];
    const tl = t.toLowerCase();
    if (
      /engineer|analyst|administrator|support|noc|network|developer|specialist|manager|designer|accountant|recruiter|marketer|consultant|coordinator|associate|scientist|architect/.test(
        tl,
      )
    ) {
      titles.push(t.replace(/\*+/g, "").trim());
    }
  }

  const targetTitles =
    dedupe([...openTo, ...titles]).slice(0, 12).length > 0
      ? dedupe([...openTo, ...titles]).slice(0, 12)
      : ["Software Engineer", "Analyst", "IT Support Engineer"];

  const huntWorthy = (t: string) =>
    /network|noc|support engineer|it support|infra|admin|security|sysadmin|systems?|cloud|devops|telecom|helpdesk|service desk|developer|engineer|analyst|designer|accountant|finance|marketing|product|data|hr|recruit/.test(
      t,
    ) && !/waiter|chef|driver|cashier/.test(t);

  const searchSeed =
    openTo.filter(huntWorthy).length > 0
      ? openTo.filter(huntWorthy)
      : targetTitles.filter(huntWorthy).length > 0
        ? targetTitles.filter(huntWorthy)
        : targetTitles.slice(0, 3);

  const emailM = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneM = text.match(/(\+?\d[\d\s\-()]{8,}\d)/);
  const linkedinM = text.match(
    /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w%-]+\/?)/i,
  );

  const certs = CERT_PATTERNS.filter(([pat]) => pat.test(blob)).map(
    ([, label]) => label,
  );
  const skills = SKILL_SEEDS.filter((s) => blob.includes(s));

  const years = estimateYears(blob);
  const juniorSignal = Boolean(
    openTo.length ||
      /\b(junior|entry[\s-]?level|fresher|associate|intern|noc l1)\b/i.test(
        blob,
      ),
  );
  const level =
    juniorSignal || (years != null && years <= 3)
      ? "junior_entry_associate"
      : "mid_or_unknown";
  const maxYearsRequired =
    juniorSignal || years == null || years <= 3
      ? 3
      : Math.min(Math.floor(years) + 1, 8);

  const projectCred = Boolean(
    /\b(project|portfolio|github|capstone|built|deployed|open\s*source)\b/i.test(
      blob,
    ),
  );

  return {
    source: "resume",
    candidate: {
      name: name || "Aspirant",
      email: emailM?.[0] || "",
      phone: phoneM?.[0]?.trim() || "",
      linkedin: linkedinM?.[1] || "",
      location: guessLocation(blob),
    },
    experience: {
      estimated_years: years,
      max_years_required: maxYearsRequired,
      level,
      target_band: maxYearsRequired <= 3 ? "0-3" : `0-${maxYearsRequired}`,
      credibility:
        projectCred || Boolean(certs.length) || (years != null && years >= 2),
    },
    target_titles: targetTitles,
    search_queries: dedupe(searchSeed).slice(0, 4),
    skills_positive: dedupe([...skills, ...certs.map((c) => c.toLowerCase())]),
    certifications: certs,
    title_must_match_any: mustMatchFromTitles(targetTitles).length
      ? mustMatchFromTitles(targetTitles)
      : titleMustFromSkills(skills, targetTitles),
    raw_excerpt: text.slice(0, 2500),
  };
}

function estimateYears(blob: string): number | null {
  const spans = [...blob.matchAll(/(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)/gi)];
  if (!spans.length) {
    const m = blob.match(
      /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/,
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
    ["dubai", "Dubai"],
    ["abu dhabi", "Abu Dhabi"],
    ["uae", "UAE"],
    ["warsaw", "Warsaw"],
    ["alberta", "Alberta"],
    ["seattle", "Seattle"],
    ["india", "India"],
    ["canada", "Canada"],
    ["poland", "Poland"],
    ["united states", "United States"],
    ["usa", "USA"],
  ];
  for (const [needle, label] of places) {
    if (blob.includes(needle)) return label;
  }
  return "";
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

function dedupe(items: string[]): string[] {
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

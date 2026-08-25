import { detectProfileFamilies, type RoleFamilyId } from "./roleFamilies";
import type { Profile } from "./types";

function normalizeQuery(title: string): string {
  return title
    .replace(
      /\s+(?:I{1,3}|IV|V|VI|[1-9]|1st|2nd|3rd|4th|level\s*[1-9])\s*$/i,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Default search phrases per role family — used to widen scrape beyond one resume title. */
const FAMILY_QUERIES: Record<RoleFamilyId, string[]> = {
  network_ops: [
    "network engineer",
    "junior network engineer",
    "NOC engineer",
    "NOC L1",
    "network administrator",
    "network technician",
    "field technician",
    "telecom technician",
  ],
  it_support: [
    "IT support engineer",
    "help desk",
    "systems administrator",
  ],
  software_eng: ["software engineer", "developer", "full stack developer"],
  data_analyst: [
    "data analyst",
    "research analyst",
    "business analyst",
    "analytics",
  ],
  cloud_devops: ["devops engineer", "cloud engineer", "SRE"],
  security: [
    "security analyst",
    "cybersecurity engineer",
    "SOC analyst",
  ],
  product_design: ["product designer", "UX designer"],
  general_analyst: ["operations analyst", "analyst"],
};

const NETWORK_SKILL_HINTS = [
  "cisco",
  "ccna",
  "ccnp",
  "routing",
  "switching",
  "vlan",
  "bgp",
  "ospf",
  "noc",
  "firewall",
  "vpn",
  "tcp/ip",
  "network",
  "juniper",
  "wireless",
];

const CERT_FAMILY_HINTS: [RegExp, RoleFamilyId][] = [
  [/\bccna\b|\bccnp\b|\bccie\b|cisco/i, "network_ops"],
  [/\bcomptia\s*network/i, "network_ops"],
  [/\baws\s+certified|azure\s+administrator|gcp/i, "cloud_devops"],
  [/\bsecurity\+|cissp|ceh\b/i, "security"],
  [/\bpmp\b|scrum master/i, "general_analyst"],
];

function dedupeQueries(items: string[]): string[] {
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

/** Extra families inferred from skills/certs even when the headline title says something else. */
export function inferExtraFamilies(profile: Profile): RoleFamilyId[] {
  const extras: RoleFamilyId[] = [];
  const blob = [
    ...(profile.skills_positive || []),
    ...(profile.certifications || []),
    profile.raw_excerpt || "",
  ]
    .join(" ")
    .toLowerCase();

  if (NETWORK_SKILL_HINTS.some((h) => blob.includes(h))) {
    extras.push("network_ops");
  }
  for (const [pat, fam] of CERT_FAMILY_HINTS) {
    if (
      pat.test(blob) ||
      (profile.certifications || []).some((c) => pat.test(c))
    ) {
      extras.push(fam);
    }
  }
  return extras;
}

/**
 * Build a wide query pool for scraping — primary resume queries first,
 * then one round per detected role family (network, data, etc.).
 */
export function buildHuntQueries(profile: Profile, max = 9): string[] {
  const primary = (
    profile.search_queries?.length
      ? profile.search_queries
      : profile.target_titles
  )?.map(normalizeQuery) || [];

  const families = [
    ...detectProfileFamilies(profile),
    ...inferExtraFamilies(profile),
  ];
  const uniqueFamilies = [...new Set(families)];

  const expanded: string[] = [...primary];
  for (const fam of uniqueFamilies) {
    for (const q of FAMILY_QUERIES[fam] || []) {
      expanded.push(q);
    }
  }

  return dedupeQueries(expanded.filter(Boolean)).slice(0, max);
}

/** Assign queries across parallel sources so each board searches something different. */
export function queryForSource(
  queries: string[],
  sourceIndex: number,
): string {
  if (!queries.length) return "engineer";
  return queries[sourceIndex % queries.length];
}

/** Role families — phrase-level title matching (not noisy single tokens). */

export type RoleFamilyId =
  | "network_ops"
  | "it_support"
  | "software_eng"
  | "data_analyst"
  | "cloud_devops"
  | "security"
  | "product_design"
  | "general_analyst";

export type RoleFamily = {
  id: RoleFamilyId;
  label: string;
  /** Multi-word / specific phrases preferred; matched with word boundaries where short. */
  phrases: string[];
  /** Weak solo tokens that must not match alone outside a phrase context. */
  weakTokens?: string[];
};

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    id: "network_ops",
    label: "Network / NOC",
    phrases: [
      "network engineer",
      "network administrator",
      "network admin",
      "network operations",
      "noc engineer",
      "noc analyst",
      "noc technician",
      "network technician",
      "network specialist",
      "routing",
      "switching",
      "cisco",
      "ccna",
      "firewall engineer",
      "network security engineer",
      "telecom engineer",
      "wireless engineer",
    ],
    weakTokens: ["network"], // "Network Partnership" must not pass on this alone
  },
  {
    id: "it_support",
    label: "IT Support",
    phrases: [
      "it support",
      "help desk",
      "helpdesk",
      "service desk",
      "desktop support",
      "technical support",
      "it technician",
      "systems administrator",
      "system administrator",
      "sysadmin",
      "it engineer",
      "infrastructure engineer",
    ],
  },
  {
    id: "software_eng",
    label: "Software Engineering",
    phrases: [
      "software engineer",
      "software developer",
      "full stack",
      "fullstack",
      "frontend engineer",
      "front-end engineer",
      "backend engineer",
      "back-end engineer",
      "web developer",
      "application developer",
      "mobile developer",
      "java developer",
      "python developer",
      "react developer",
      "node.js",
      "nodejs",
    ],
  },
  {
    id: "data_analyst",
    label: "Data / Analytics",
    phrases: [
      "data analyst",
      "business analyst",
      "data scientist",
      "data engineer",
      "bi analyst",
      "analytics",
      "research analyst",
      "reporting analyst",
    ],
  },
  {
    id: "cloud_devops",
    label: "Cloud / DevOps",
    phrases: [
      "devops",
      "sre",
      "site reliability",
      "cloud engineer",
      "platform engineer",
      "aws engineer",
      "azure engineer",
      "kubernetes",
      "ci/cd",
    ],
  },
  {
    id: "security",
    label: "Security",
    phrases: [
      "security engineer",
      "cybersecurity",
      "infosec",
      "security analyst",
      "soc analyst",
      "penetration",
      "appsec",
    ],
  },
  {
    id: "product_design",
    label: "Product / Design",
    phrases: [
      "product manager",
      "product designer",
      "ux designer",
      "ui designer",
      "product owner",
    ],
  },
  {
    id: "general_analyst",
    label: "Analyst (general)",
    phrases: ["operations analyst", "junior analyst", "associate analyst"],
  },
];

const STOP = new Set([
  "with",
  "from",
  "into",
  "junior",
  "senior",
  "sr",
  "the",
  "and",
  "for",
  "role",
  "position",
]);

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phraseInTitle(title: string, phrase: string): boolean {
  const t = title.toLowerCase();
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (p.includes(" ") || p.length > 5) return t.includes(p);
  return new RegExp(`\\b${escapeReg(p)}\\b`, "i").test(t);
}

/** Detect families present in aspirant target titles + must-match phrases. */
export function detectProfileFamilies(profile: {
  target_titles?: string[];
  title_must_match_any?: string[];
  skills_positive?: string[];
}): RoleFamilyId[] {
  const blob = [
    ...(profile.target_titles || []),
    ...(profile.title_must_match_any || []),
    ...(profile.skills_positive || []).slice(0, 20),
  ]
    .join(" ")
    .toLowerCase();

  const hits: RoleFamilyId[] = [];
  for (const fam of ROLE_FAMILIES) {
    const hit = fam.phrases.some((ph) => blob.includes(ph.toLowerCase()));
    if (hit) hits.push(fam.id);
  }
  return hits.length ? hits : ["software_eng", "it_support", "network_ops"];
}

/**
 * Strong title match: full target title phrase, family phrase, or multi-word must signal.
 * Weak solo tokens (e.g. "network") alone are NOT enough.
 *
 * Prefer compileTitleMatcher once per hunt, then matchTitleCompiled per job.
 */
export type CompiledTitleMatcher = {
  targetTitles: string[];
  familyPhraseSets: { id: RoleFamilyId; phrases: string[] }[];
  mustMatch: string[];
};

const FAMILY_BY_ID: Map<RoleFamilyId, RoleFamily> = new Map(
  ROLE_FAMILIES.map((f) => [f.id, f]),
);

export function compileTitleMatcher(profile: {
  target_titles?: string[];
  title_must_match_any?: string[];
  skills_positive?: string[];
}): CompiledTitleMatcher {
  const families = detectProfileFamilies(profile);
  return {
    targetTitles: (profile.target_titles || [])
      .map((t) => t.trim())
      .filter((t) => t.length >= 4),
    familyPhraseSets: families.map((id) => ({
      id,
      phrases: FAMILY_BY_ID.get(id)?.phrases || [],
    })),
    mustMatch: (profile.title_must_match_any || [])
      .map((s) => s.trim())
      .filter((s) => s && !STOP.has(s.toLowerCase()))
      .filter((s) => s.length > 5 || s.includes(" ")),
  };
}

export function matchTitleCompiled(
  title: string,
  compiled: CompiledTitleMatcher,
): { ok: boolean; matched: string[]; familyIds: RoleFamilyId[] } {
  const t = (title || "").toLowerCase();
  const matched: string[] = [];
  const familyIds: RoleFamilyId[] = [];

  for (const target of compiled.targetTitles) {
    const tt = target.toLowerCase();
    if (t.includes(tt) || phraseInTitle(t, tt)) {
      matched.push(target);
    }
  }

  for (const fam of compiled.familyPhraseSets) {
    for (const ph of fam.phrases) {
      if (phraseInTitle(t, ph)) {
        matched.push(ph);
        if (!familyIds.includes(fam.id)) familyIds.push(fam.id);
        break;
      }
    }
  }

  for (const sig of compiled.mustMatch) {
    if (phraseInTitle(t, sig)) matched.push(sig);
  }

  return {
    ok: matched.length > 0,
    matched: [...new Set(matched)].slice(0, 6),
    familyIds,
  };
}

export function matchTitleToProfile(
  title: string,
  profile: {
    target_titles?: string[];
    title_must_match_any?: string[];
    skills_positive?: string[];
  },
): { ok: boolean; matched: string[]; familyIds: RoleFamilyId[] } {
  return matchTitleCompiled(title, compileTitleMatcher(profile));
}

/** Build clean title_must_match_any from titles — phrases only, no token soup. */
export function mustMatchFromTitles(titles: string[]): string[] {
  const out: string[] = [];
  for (const title of titles) {
    const t = title.trim();
    if (t.length < 4) continue;
    out.push(t);
    // Also add family phrases that appear inside the title
    for (const fam of ROLE_FAMILIES) {
      for (const ph of fam.phrases) {
        if (t.toLowerCase().includes(ph) && ph.includes(" ")) out.push(ph);
      }
    }
  }
  return uniq(out).slice(0, 16);
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = item.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item.trim());
  }
  return out;
}

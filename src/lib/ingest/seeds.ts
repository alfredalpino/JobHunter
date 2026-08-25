import { ROLE_FAMILIES } from "@/lib/roleFamilies";
import { REGIONS } from "@/lib/config";

/** Seed query packs for corpus ingest (not per-user). */
export type IngestSeed = {
  familyId: string;
  query: string;
  regionId: string;
  location: string;
  country: string;
};

const FAMILY_SEED_QUERIES: Record<string, string[]> = {
  network_ops: [
    "network engineer",
    "NOC engineer",
    "network technician",
    "network administrator",
  ],
  it_support: [
    "IT support",
    "help desk",
    "desktop support",
    "service desk",
  ],
  software_eng: [
    "software engineer",
    "full stack developer",
    "backend engineer",
  ],
  data_analyst: ["data analyst", "business analyst", "data engineer"],
  cloud_devops: ["devops engineer", "cloud engineer", "SRE"],
  security: ["security analyst", "cybersecurity engineer"],
  product_design: ["product designer", "UX designer"],
  general_analyst: ["analyst", "operations analyst"],
};

/** Regions to rotate through on each ingest (keep crawl light). */
const SEED_REGION_IDS = [
  "remote",
  "dubai",
  "usa",
  "india",
  "alberta",
  "warsaw",
] as const;

/**
 * Build seed query × region pairs for shared-index ingest.
 * Caps total seeds so a single cron stays within Vercel maxDuration.
 */
export function buildIngestSeeds(opts?: {
  maxSeeds?: number;
  regionIds?: string[];
}): IngestSeed[] {
  const maxSeeds = opts?.maxSeeds ?? 18;
  const regionIds = opts?.regionIds?.length
    ? opts.regionIds
    : [...SEED_REGION_IDS];
  const seeds: IngestSeed[] = [];

  for (const family of ROLE_FAMILIES) {
    const queries =
      FAMILY_SEED_QUERIES[family.id] ||
      family.phrases.slice(0, 2).map((p) => p);
    for (const query of queries.slice(0, 2)) {
      for (const regionId of regionIds) {
        const region = REGIONS.find((r) => r.id === regionId);
        if (!region) continue;
        seeds.push({
          familyId: family.id,
          query,
          regionId: region.id,
          location: region.locations[0] || "",
          country: region.country_indeed,
        });
        if (seeds.length >= maxSeeds) return seeds;
      }
    }
  }
  return seeds;
}

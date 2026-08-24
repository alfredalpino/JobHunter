import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/config";
import type { RegionPack } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal YAML map/list parse for region packs. */
function parseRegionYaml(id: string, raw: string): RegionPack | null {
  const lines = raw.split(/\r?\n/);
  let label = id;
  let country_indeed = "";
  const locations: string[] = [];
  const allow_signals: string[] = [];
  const reject_signals: string[] = [];
  let mode: "locations" | "allow_signals" | "reject_signals" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && mode) {
      const v = listItem[1].trim().replace(/^["']|["']$/g, "");
      if (mode === "locations") locations.push(v);
      else if (mode === "allow_signals") allow_signals.push(v);
      else reject_signals.push(v);
      continue;
    }
    const kv = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (key === "locations" || key === "allow_signals" || key === "reject_signals") {
      mode = key;
      continue;
    }
    mode = null;
    if (key === "label") label = value || id;
    else if (key === "country_indeed") country_indeed = value;
  }

  return {
    id,
    label,
    locations,
    country_indeed,
    allow_signals,
    reject_signals,
  };
}

async function loadRegionsFromYaml(): Promise<RegionPack[] | null> {
  const dir = path.join(process.cwd(), "config", "regions");
  try {
    const files = await fs.readdir(dir);
    const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    if (!yamlFiles.length) return null;
    const packs: RegionPack[] = [];
    for (const file of yamlFiles.sort()) {
      const id = file.replace(/\.ya?ml$/, "");
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      const pack = parseRegionYaml(id, raw);
      if (pack) packs.push(pack);
    }
    return packs.length ? packs : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const fromYaml = await loadRegionsFromYaml();
  const regions = fromYaml || REGIONS;
  return NextResponse.json({
    regions: regions.map((r) => ({
      id: r.id,
      label: r.label,
      locations: r.locations,
      country_indeed: r.country_indeed,
    })),
    source: fromYaml
      ? "config/regions/*.yaml"
      : "frontend/src/lib/config.ts (fallback)",
  });
}

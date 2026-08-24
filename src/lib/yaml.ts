import type { Preferences } from "./types";
import { defaultPreferences } from "./preferences";

/** Minimal YAML subset for preferences (maps, string lists, comments). */
export function preferencesToYaml(prefs: Preferences): string {
  const lines: string[] = [
    "# JobHunter preferences — editable in the browser or any text editor",
    `region: ${prefs.region || "dubai"}`,
    "locations:",
  ];
  for (const loc of prefs.locations || []) {
    lines.push(`  - ${yamlScalar(loc)}`);
  }
  if (prefs.target_titles?.length) {
    lines.push("target_titles:");
    for (const t of prefs.target_titles) lines.push(`  - ${yamlScalar(t)}`);
  }
  if (prefs.must_have_skills?.length) {
    lines.push("must_have_skills:");
    for (const s of prefs.must_have_skills) lines.push(`  - ${yamlScalar(s)}`);
  }
  if (prefs.exclude_titles?.length) {
    lines.push("exclude_titles:");
    for (const s of prefs.exclude_titles) lines.push(`  - ${yamlScalar(s)}`);
  }
  lines.push(`seniority_band: ${prefs.seniority_band || "junior"}`);
  if (prefs.work_auth) lines.push(`work_auth: ${yamlScalar(prefs.work_auth)}`);
  lines.push(`work_mode: ${prefs.work_mode || "any"}`);
  if (prefs.country_indeed) {
    lines.push(`country_indeed: ${prefs.country_indeed}`);
  }
  lines.push(`recency_max_days: ${prefs.recency_max_days || 14}`);
  if (prefs.date_window) lines.push(`date_window: ${prefs.date_window}`);
  lines.push("# No auto-apply — you open links and apply yourself.");
  return lines.join("\n") + "\n";
}

type ListKey =
  | "locations"
  | "target_titles"
  | "must_have_skills"
  | "exclude_titles";

export function parsePreferencesYaml(raw: string): Preferences {
  const base = defaultPreferences("dubai");
  const lines = raw.split(/\r?\n/);
  let mode: ListKey | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && mode) {
      base[mode].push(unquote(listItem[1].trim()));
      continue;
    }

    const kv = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();

    if (
      key === "locations" ||
      key === "target_titles" ||
      key === "must_have_skills" ||
      key === "exclude_titles"
    ) {
      mode = key;
      base[key] = [];
      continue;
    }

    mode = null;
    if (key === "region") base.region = unquote(value) || "dubai";
    else if (key === "seniority_band") base.seniority_band = unquote(value);
    else if (key === "work_auth") base.work_auth = unquote(value);
    else if (key === "work_mode") {
      const wm = unquote(value) as Preferences["work_mode"];
      if (["any", "remote", "onsite", "hybrid"].includes(wm)) base.work_mode = wm;
    } else if (key === "country_indeed") base.country_indeed = unquote(value);
    else if (key === "date_window") {
      base.date_window = unquote(value) as Preferences["date_window"];
    } else if (key === "recency_max_days") {
      const n = parseInt(value, 10);
      if (!Number.isNaN(n)) base.recency_max_days = Math.min(Math.max(n, 1), 30);
    }
  }

  return base;
}

function yamlScalar(s: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(s) || /\s/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

import { SKILL_SYNONYMS } from "./config";

export function expandSkills(skills: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (item: string) => {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item.trim());
  };

  for (const skill of skills) {
    add(skill);
    const low = skill.toLowerCase().trim();
    for (const [base, alts] of Object.entries(SKILL_SYNONYMS)) {
      if (low === base || alts.includes(low)) {
        add(base);
        for (const a of alts) add(a);
      }
    }
  }
  return out;
}

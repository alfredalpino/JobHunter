import { describe, expect, it } from "vitest";
import { expandSkills } from "./synonyms";

describe("expandSkills", () => {
  it("expands known synonym groups", () => {
    const out = expandSkills(["ccna"]);
    const lower = out.map((s) => s.toLowerCase());
    expect(lower).toContain("ccna");
    expect(lower.length).toBeGreaterThan(1);
  });

  it("dedupes case-insensitively", () => {
    const out = expandSkills(["Network", "network"]);
    expect(out.filter((s) => s.toLowerCase() === "network")).toHaveLength(1);
  });

  it("keeps unknown skills", () => {
    expect(expandSkills(["obscure-tool-xyz"])).toContain("obscure-tool-xyz");
  });
});

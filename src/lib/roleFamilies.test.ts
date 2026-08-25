import { describe, expect, it } from "vitest";
import { matchTitleToProfile } from "./roleFamilies";

describe("network_ops phrases", () => {
  it("matches field technician titles", () => {
    const m = matchTitleToProfile("Field Technician III", {
      target_titles: ["Network Engineer"],
      skills_positive: ["cisco", "routing"],
    });
    expect(m.ok).toBe(true);
  });
});

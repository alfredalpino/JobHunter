import { describe, expect, it } from "vitest";
import {
  applyUrlIdentity,
  contentHash,
  normalizeCompany,
  normalizeTitle,
  shouldMergeClusters,
} from "./cluster";

describe("cluster normalize", () => {
  it("strips roman numerals and level suffixes from titles", () => {
    expect(normalizeTitle("Network Engineer III")).toBe("network engineer");
    expect(normalizeTitle("NOC Analyst II")).toBe("noc analyst");
    expect(normalizeTitle("Software Engineer Sr.")).toBe("software engineer");
  });

  it("normalizes company legal suffixes", () => {
    expect(normalizeCompany("Acme Corp.")).toBe("acme");
    expect(normalizeCompany("Foo Bar LLC")).toBe("foo bar");
    expect(normalizeCompany("Baz Ltd")).toBe("baz");
  });

  it("builds stable apply URL identity", () => {
    expect(applyUrlIdentity("https://www.Example.com/jobs/123?ref=x")).toBe(
      "example.com/jobs/123",
    );
    expect(applyUrlIdentity("https://example.com/jobs/123/")).toBe(
      "example.com/jobs/123",
    );
  });

  it("hashes summary content stably", () => {
    const a = contentHash("Cisco CCNA routing and switching for NOC");
    const b = contentHash("Cisco CCNA routing and switching for NOC");
    const c = contentHash("Completely different summary about sales");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("shouldMergeClusters", () => {
  it("hard-merges identical apply host+path", () => {
    expect(
      shouldMergeClusters(
        {
          title: "Network Engineer",
          company: "Acme",
          url: "https://boards.greenhouse.io/acme/jobs/1",
        },
        {
          title: "Different Title",
          company: "Other Co",
          url: "https://boards.greenhouse.io/acme/jobs/1?utm=1",
        },
      ),
    ).toBe(true);
  });

  it("soft-merges same normalized title+company", () => {
    expect(
      shouldMergeClusters(
        {
          title: "Network Engineer III",
          company: "Acme Inc",
          url: "https://remoteok.com/a",
          summary: "Cisco routing",
        },
        {
          title: "Network Engineer",
          company: "Acme",
          url: "https://remotive.com/b",
          summary: "Cisco routing",
        },
      ),
    ).toBe(true);
  });

  it("does not merge different companies", () => {
    expect(
      shouldMergeClusters(
        {
          title: "Network Engineer",
          company: "Acme",
          url: "https://a.example/1",
        },
        {
          title: "Network Engineer",
          company: "Other",
          url: "https://b.example/2",
        },
      ),
    ).toBe(false);
  });
});

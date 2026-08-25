import { describe, expect, it } from "vitest";
import { escapeCsvCell, rowsToCsv } from "./csv";
import { chunkForWhatsApp, formatJobCompact } from "./whatsapp";
import {
  decodeSharePayload,
  encodeSharePayload,
} from "./shareLink";
import { jobToExportRow } from "./normalize";
import type { Job } from "../types";

const sampleJob: Job = {
  title: "=HYPERLINK evil",
  company: "Acme",
  url: "https://example.com/job/1",
  portal: "remoteok",
  location: "Dubai",
  summary: "Build things",
  posted_at: "2026-08-20",
  eligible: true,
  score: 85,
  match: {
    band: "A",
    score: 85,
    title_matched: ["engineer"],
    skills_matched: ["python"],
    geo_matched: true,
    seniority_ok: true,
  },
};

describe("escapeCsvCell", () => {
  it("prefixes formula injection cells", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
  });

  it("quotes cells with commas", () => {
    expect(escapeCsvCell("hello, world")).toBe('"hello, world"');
  });
});

describe("rowsToCsv", () => {
  it("includes header and escaped title", () => {
    const row = jobToExportRow(sampleJob, {});
    const csv = rowsToCsv([row]);
    expect(csv.split("\n")[0]).toContain("title");
    expect(csv).toContain("'=HYPERLINK evil");
  });
});

describe("chunkForWhatsApp", () => {
  it("splits long text into multiple chunks", () => {
    const long = "x".repeat(2000);
    const chunks = chunkForWhatsApp(long, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(500);
    }
  });

  it("keeps short text in one chunk", () => {
    expect(chunkForWhatsApp("hello")).toEqual(["hello"]);
  });
});

describe("formatJobCompact", () => {
  it("includes band, title, and url", () => {
    const text = formatJobCompact(sampleJob, { applied: {}, scope: "visible" });
    expect(text).toContain("[A]");
    expect(text).toContain("Acme");
    expect(text).toContain("https://example.com/job/1");
  });
});

describe("shareLink roundtrip", () => {
  it("encodes and decodes a small payload", () => {
    const { hash, error } = encodeSharePayload([sampleJob], {
      applied: {},
      candidateName: "Jane",
      scope: "visible",
    });
    expect(error).toBeUndefined();
    expect(hash).toBeTruthy();
    const decoded = decodeSharePayload(hash!);
    expect(decoded?.jobs).toHaveLength(1);
    expect(decoded?.manifest.candidateName).toBe("Jane");
  });

  it("rejects too many jobs", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...sampleJob,
      url: `https://example.com/${i}`,
    }));
    const { error } = encodeSharePayload(many, {
      applied: {},
      scope: "visible",
    });
    expect(error).toMatch(/20/);
  });
});

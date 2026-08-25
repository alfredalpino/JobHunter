import { describe, expect, it } from "vitest";
import {
  decodeXml,
  jobicyTagFromQuery,
  matchesQuery,
  museCategoryForQuery,
  normalizePostedAt,
  parseJobBankHtml,
  parseRssItems,
  resolveAdzunaCountries,
} from "./sourceParse";

describe("decodeXml", () => {
  it("unwraps CDATA and entities", () => {
    expect(decodeXml("<![CDATA[A &amp; B]]>")).toBe("A & B");
    expect(decodeXml("&lt;x&gt;")).toBe("<x>");
    expect(decodeXml("A &amp;amp; B")).toBe("A & B");
  });
});

describe("matchesQuery", () => {
  it("requires tokens or full phrase", () => {
    expect(
      matchesQuery("Senior Network Engineer Dubai", ["network engineer"]),
    ).toBe(true);
    expect(matchesQuery("Marketing Manager", ["network engineer"])).toBe(
      false,
    );
  });
});

describe("parseRssItems", () => {
  it("parses CDATA titles and links", () => {
    const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Acme: Network Engineer]]></title>
        <link>https://example.com/jobs/1</link>
        <pubDate>Mon, 25 Aug 2026 12:00:00 +0000</pubDate>
        <description><![CDATA[<p>BGP and firewalls</p>]]></description>
      </item>
      <item>
        <title>Skip me</title>
        <guid>https://example.com/jobs/1</guid>
      </item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Acme: Network Engineer");
    expect(items[0].link).toBe("https://example.com/jobs/1");
    expect(items[0].description).toContain("BGP");
  });
});

describe("normalizePostedAt", () => {
  it("handles unix seconds and ISO strings", () => {
    expect(normalizePostedAt(1_700_000_000)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalizePostedAt("2026-08-20T10:00:00Z")).toBe("2026-08-20");
    expect(normalizePostedAt("")).toBe("");
  });
});

describe("parseJobBankHtml", () => {
  it("extracts noctitle, company, location", () => {
    const html = `
<article id="article-1"><a href="/jobsearch/jobposting/50073581;jsessionid=ABC?source=searchresults" class="resultJobItem">
  <h3 class="title"><span class="noctitle"> electrical network engineer </span></h3>
  <ul>
    <li class="date">August 13, 2026</li>
    <li class="business">Fed Manutech</li>
    <li class="location"><span class="wb-inv">Location</span> Sherbrooke (QC)</li>
    <li class="salary">Salary $67,000.00 annually</li>
  </ul>
</a></article>`;
    const jobs = parseJobBankHtml(html, "Alberta");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("electrical network engineer");
    expect(jobs[0].company).toBe("Fed Manutech");
    expect(jobs[0].url).toBe(
      "https://www.jobbank.gc.ca/jobsearch/jobposting/50073581",
    );
    expect(jobs[0].location).toContain("Sherbrooke");
    expect(jobs[0].summary).toMatch(/Salary/i);
  });
});

describe("jobicyTagFromQuery / museCategoryForQuery", () => {
  it("maps network and support queries", () => {
    expect(jobicyTagFromQuery("NOC engineer")).toBe("sysadmin");
    expect(jobicyTagFromQuery("help desk analyst")).toBe("support");
    expect(museCategoryForQuery("network engineer")).toBe("Computer and IT");
    expect(museCategoryForQuery("data analyst")).toBe("Data and Analytics");
  });
});

describe("resolveAdzunaCountries", () => {
  it("expands remote packs across a few markets", () => {
    const remote = resolveAdzunaCountries("remote", "", "");
    expect(remote[0]).toBe("us");
    expect(remote.length).toBeGreaterThanOrEqual(2);
    expect(remote.length).toBeLessThanOrEqual(3);

    const dubai = resolveAdzunaCountries("dubai", "uae", "");
    expect(dubai).toContain("ae");
  });

  it("honors env override", () => {
    expect(resolveAdzunaCountries("remote", "", "gb, ae")).toEqual([
      "gb",
      "ae",
    ]);
  });
});

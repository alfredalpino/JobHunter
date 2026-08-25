import { describe, expect, it } from "vitest";
import {
  analyzeResumeText,
  dedupe,
  estimateYears,
  extractEmail,
  extractExperienceEntries,
  extractExperienceTitles,
  extractPhone,
  extractSkillsSection,
  guessRegionFromLocation,
  inferMaxJobLevel,
  isNonProfessionalTitle,
  isPlausibleEmail,
  normalizeSearchQuery,
  sanitizeEmailAddress,
  selectCareerRelevantTitles,
} from "./resume";

const NETWORK_CV = `
John Smith
john.smith@email.com | +971 50 123 4567
Dubai, UAE | linkedin.com/in/johnsmith

Open to: Network Engineer, NOC Engineer

PROFESSIONAL SUMMARY
CCNA certified network engineer with hands-on Cisco routing and switching.

EXPERIENCE
Acme Telecom — Network Engineer
2021 – Present
- Managed VLANs, OSPF, firewalls
- NOC L1 support escalation

Tech Corp | Junior Network Administrator
2019 – 2021

SKILLS
Cisco, CCNA, routing, switching, firewall, VPN, troubleshooting, Linux

CERTIFICATIONS
CCNA, CompTIA Network+
`;

const CAREER_PIVOT_CV = `
Alex Dev
alex@email.com

EXPERIENCE
Tech Corp — Software Engineer II
2022 – Present
- Built React and Node applications

CleanCo — Janitor
2016 – 2018

MegaMart — Sales Associate
2014 – 2016

SKILLS
JavaScript, React, TypeScript, Python, Node.js
`;

describe("analyzeResumeText", () => {
  it("extracts contact, titles, skills, and certifications", () => {
    const p = analyzeResumeText(NETWORK_CV);
    expect(p.candidate.name).toBe("John Smith");
    expect(p.candidate.email).toBe("john.smith@email.com");
    expect(p.candidate.phone).toContain("971");
    expect(p.candidate.location).toBe("Dubai");
    expect(p.target_titles.map((t) => t.toLowerCase())).toEqual(
      expect.arrayContaining(["network engineer", "noc engineer"]),
    );
    expect(p.skills_positive).toEqual(
      expect.arrayContaining(["cisco", "routing", "switching"]),
    );
    expect(p.certifications).toContain("CCNA");
    expect(p.experience.max_job_level).toBeDefined();
    expect(p.experience.estimated_years).toBeGreaterThan(0);
    expect(p.search_queries.length).toBeGreaterThan(0);
  });

  it("uses display name when provided", () => {
    const p = analyzeResumeText("Jane Doe\nSoftware Engineer", "Jane Doe");
    expect(p.candidate.name).toBe("Jane Doe");
  });

  it("extracts professional summary", () => {
    const p = analyzeResumeText(NETWORK_CV);
    expect(p.plain_summary?.toLowerCase()).toContain("network engineer");
  });

  it("extracts github when present", () => {
    const p = analyzeResumeText(
      "Jane Doe\ngithub.com/janedoe\nSoftware Engineer",
    );
    expect(p.candidate.github).toContain("github.com/janedoe");
  });

  it("does not glue phone digits into email", () => {
    const cv = `
Ubaid Ur Rahman Siddiqui
8303796759ubaid.in.2003@gmail.com
+91- 8303796759
Lucknow
Research Analyst
`;
    const p = analyzeResumeText(cv, "Ubaid Ur Rahman Siddiqui");
    expect(p.candidate.email).toBe("ubaid.in.2003@gmail.com");
    expect(p.candidate.email).not.toContain("8303796759");
    expect(p.candidate.phone.replace(/\D/g, "")).toContain("8303796759");
  });

  it("finds phone when only glued before email on one line", () => {
    const phone = extractPhone("8303796759ubaid.in.2003@gmail.com");
    expect(phone).toMatch(/8303796759/);
    expect(phone).toMatch(/\+91/);
  });

  it("ignores early unrelated jobs when career pivoted to software", () => {
    const p = analyzeResumeText(CAREER_PIVOT_CV);
    const titlesLow = p.target_titles.map((t) => t.toLowerCase());
    const queriesLow = p.search_queries.map((q) => q.toLowerCase());

    expect(titlesLow).toEqual(
      expect.arrayContaining(["software engineer ii"]),
    );
    expect(titlesLow.some((t) => /janitor|sales associate/.test(t))).toBe(
      false,
    );
    expect(queriesLow.some((q) => /janitor|sales|associate/.test(q))).toBe(
      false,
    );
    expect(queriesLow[0]).toContain("software engineer");
  });
});

describe("extractEmail", () => {
  it("strips leading phone digits from glued local part", () => {
    expect(
      sanitizeEmailAddress("8303796759ubaid.in.2003@gmail.com"),
    ).toBe("ubaid.in.2003@gmail.com");
    expect(
      extractEmail("8303796759ubaid.in.2003@gmail.com"),
    ).toBe("ubaid.in.2003@gmail.com");
  });

  it("keeps normal emails intact", () => {
    expect(extractEmail("Contact: john.smith@email.com | +971 50 123 4567")).toBe(
      "john.smith@email.com",
    );
  });

  it("rejects digit-only local parts", () => {
    expect(isPlausibleEmail("8303796759@gmail.com")).toBe(false);
  });
});

describe("extractPhone", () => {
  it("finds phone without stealing email digits", () => {
    const phone = extractPhone(
      "8303796759ubaid.in.2003@gmail.com +91-8303796759",
    );
    expect(phone.replace(/\D/g, "")).toContain("8303796759");
  });

  it("handles +91 with space after dash", () => {
    const phone = extractPhone("ubaid.in.2003@gmail.com\n+91- 8303796759");
    expect(phone.replace(/\D/g, "")).toContain("8303796759");
  });

  it("recovers glued-only phone when email strip would remove it", () => {
    const phone = extractPhone("8303796759ubaid.in.2003@gmail.com");
    expect(phone).toMatch(/8303796759/);
  });
});

describe("selectCareerRelevantTitles", () => {
  it("uses only recent coherent roles for search", () => {
    const lines = CAREER_PIVOT_CV.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const entries = extractExperienceEntries(lines);
    const { searchQueries, targetTitles } = selectCareerRelevantTitles({
      entries,
      openTo: [],
      headline: "",
      skills: ["javascript", "react", "typescript"],
    });
    expect(searchQueries[0]?.toLowerCase()).toContain("software engineer");
    expect(
      targetTitles.some((t) => isNonProfessionalTitle(t)),
    ).toBe(false);
  });
});

describe("normalizeSearchQuery", () => {
  it("strips level suffixes", () => {
    expect(normalizeSearchQuery("Software Engineer II")).toBe("Software Engineer");
    expect(normalizeSearchQuery("Network Engineer 2")).toBe("Network Engineer");
  });
});

describe("extractExperienceTitles", () => {
  it("parses titles under experience section", () => {
    const lines = NETWORK_CV.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const titles = extractExperienceTitles(lines);
    expect(titles.map((t) => t.toLowerCase())).toEqual(
      expect.arrayContaining([
        "network engineer",
        "junior network administrator",
      ]),
    );
  });
});

describe("extractSkillsSection", () => {
  it("parses comma-separated skills block", () => {
    const lines = NETWORK_CV.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const skills = extractSkillsSection(lines);
    expect(skills).toEqual(expect.arrayContaining(["cisco", "routing", "linux"]));
  });
});

describe("guessRegionFromLocation", () => {
  it("maps locations to region packs", () => {
    expect(guessRegionFromLocation("Dubai, UAE")).toBe("dubai");
    expect(guessRegionFromLocation("Bangalore, India")).toBe("bangalore");
    expect(guessRegionFromLocation("Remote worldwide")).toBe("remote");
  });
});

describe("inferMaxJobLevel", () => {
  it("detects senior from title signals", () => {
    expect(
      inferMaxJobLevel("senior network engineer 10 years", 10, [
        "Senior Network Engineer",
      ]),
    ).toBe("senior");
  });
});

describe("estimateYears", () => {
  it("sums employment date spans", () => {
    const years = estimateYears("2019 – 2021 and 2021 – present");
    expect(years).toBeGreaterThanOrEqual(5);
  });
});

describe("dedupe", () => {
  it("removes case-insensitive duplicates", () => {
    expect(dedupe(["Network", "network", "NOC"])).toEqual(["Network", "NOC"]);
  });
});

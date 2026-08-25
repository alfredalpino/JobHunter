import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { Job, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_RESUME = 1800;
const MODEL = "gemini-2.0-flash";

function squash(text: string, limit: number): string {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cacheDir(): string {
  return path.join(process.cwd(), "data", "ai-cache");
}

async function readCache(key: string): Promise<unknown | null> {
  try {
    const p = path.join(cacheDir(), `${key}.json`);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    const dir = cacheDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `${key}.json`),
      JSON.stringify(data, null, 2),
      "utf8",
    );
  } catch {
    /* cache best-effort */
  }
}

function cacheKey(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

function resolveGeminiKey(
  request: Request,
  body: Record<string, unknown>,
): { key: string; byok: boolean } | null {
  const fromBody =
    typeof body.geminiKey === "string" ? body.geminiKey.trim() : "";
  const fromHeader = request.headers.get("x-gemini-key")?.trim() || "";
  const userKey = fromBody || fromHeader;
  if (userKey) return { key: userKey, byok: true };
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) return { key: envKey, byok: false };
  return null;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

function mergeProfilePolish(profile: Profile, polish: Record<string, unknown>): Profile {
  const next = { ...profile };
  if (Array.isArray(polish.target_titles) && polish.target_titles.length) {
    next.target_titles = polish.target_titles.map(String).slice(0, 8);
  }
  if (Array.isArray(polish.search_queries) && polish.search_queries.length) {
    next.search_queries = polish.search_queries.map(String).slice(0, 4);
  }
  if (Array.isArray(polish.skills_positive) && polish.skills_positive.length) {
    next.skills_positive = polish.skills_positive.map(String).slice(0, 20);
  }
  if (
    Array.isArray(polish.title_must_match_any) &&
    polish.title_must_match_any.length
  ) {
    next.title_must_match_any = polish.title_must_match_any
      .map(String)
      .slice(0, 12);
  }
  if (typeof polish.plain_summary === "string") {
    next.plain_summary = polish.plain_summary.slice(0, 280);
  }
  if (polish.experience && typeof polish.experience === "object") {
    const exp = polish.experience as Record<string, unknown>;
    next.experience = {
      ...next.experience,
      ...(typeof exp.max_years_required === "number"
        ? { max_years_required: exp.max_years_required }
        : {}),
      ...(typeof exp.target_band === "string"
        ? { target_band: exp.target_band }
        : {}),
      ...(typeof exp.level === "string" ? { level: exp.level } : {}),
    };
  }
  return next;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mode = body?.mode as string;
    const resolved = resolveGeminiKey(request, body);
    if (!resolved) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Gemini key — paste your API key under Optional AI polish (BYOK) or set GEMINI_API_KEY on the server.",
        },
        { status: 400 },
      );
    }
    const { key: geminiKey, byok } = resolved;

    if (mode === "profile") {
      const profile = body.profile as Profile;
      if (!profile) {
        return NextResponse.json(
          { ok: false, error: "Missing profile" },
          { status: 400 },
        );
      }
      const key = cacheKey({
        mode: "profile",
        excerpt: squash(profile.raw_excerpt || "", MAX_RESUME),
        titles: profile.target_titles,
      });
      if (!byok) {
        const cached = await readCache(key);
        if (
          cached &&
          typeof cached === "object" &&
          cached !== null &&
          "profile" in cached
        ) {
          return NextResponse.json({
            ok: true,
            cached: true,
            byok: false,
            profile: (cached as { profile: Profile }).profile,
            message: "Loaded polished profile from cache.",
          });
        }
      }

      const prompt = `You polish a job-seeker profile for JobHunter. Return JSON only with keys:
target_titles (array), search_queries (array max 4), skills_positive (array), title_must_match_any (multi-word phrases preferred), experience {max_years_required, target_band, level}, plain_summary (one short sentence).
Keep seniority realistic. Never invent executive titles for juniors. Prefer network/NOC titles when resume shows CCNA, routing, switching, or telecom skills.
Draft titles: ${JSON.stringify(profile.target_titles)}
Draft skills: ${JSON.stringify(profile.skills_positive.slice(0, 15))}
Resume excerpt: ${squash(profile.raw_excerpt || "", MAX_RESUME)}`;

      const text = await callGemini(prompt, geminiKey);
      const polish = JSON.parse(text) as Record<string, unknown>;
      const merged = mergeProfilePolish(profile, polish);
      if (!byok) {
        await writeCache(key, { profile: merged });
      }
      return NextResponse.json({
        ok: true,
        cached: false,
        byok,
        profile: merged,
        message: byok
          ? "Profile polished with your Gemini key."
          : "Profile polished with Gemini Flash.",
      });
    }

    if (mode === "matches") {
      const profile = body.profile as Profile;
      const jobs = (body.jobs || []) as Job[];
      if (!profile || !jobs.length) {
        return NextResponse.json(
          { ok: false, error: "Missing profile or jobs" },
          { status: 400 },
        );
      }
      const slim = jobs.slice(0, 15).map((j) => ({
        url: j.url,
        title: j.title,
        company: j.company,
        summary: squash(j.summary || "", 200),
      }));
      const key = cacheKey({
        mode: "matches",
        name: profile.candidate.name,
        titles: profile.target_titles,
        jobs: slim.map((j) => j.url),
      });
      if (!byok) {
        const cached = await readCache(key);
        if (
          cached &&
          typeof cached === "object" &&
          cached !== null &&
          "jobs" in cached
        ) {
          return NextResponse.json({
            ok: true,
            cached: true,
            byok: false,
            jobs: (cached as { jobs: Job[] }).jobs,
          });
        }
      }

      const prompt = `For each job, write a one-line why-fit and up to 3 resume bullets to emphasize. Return JSON: { "items": [ { "url": "...", "ai_note": "...", "ai_bullets": ["..."] } ] }
Candidate: ${profile.candidate.name}
Titles: ${profile.target_titles.join(", ")}
Skills: ${profile.skills_positive.slice(0, 12).join(", ")}
Jobs: ${JSON.stringify(slim)}`;

      const text = await callGemini(prompt, geminiKey);
      const parsed = JSON.parse(text) as {
        items?: { url: string; ai_note?: string; ai_bullets?: string[] }[];
      };
      const byUrl = new Map((parsed.items || []).map((i) => [i.url, i]));
      const out = jobs.slice(0, 15).map((j) => {
        const n = byUrl.get(j.url);
        return {
          ...j,
          ai_note: n?.ai_note || "",
          ai_bullets: n?.ai_bullets || [],
        };
      });
      if (!byok) {
        await writeCache(key, { jobs: out });
      }
      return NextResponse.json({ ok: true, cached: false, byok, jobs: out });
    }

    if (mode === "rerank") {
      const profile = body.profile as Profile;
      const jobs = (body.jobs || []) as Job[];
      if (!profile || !jobs.length) {
        return NextResponse.json(
          { ok: false, error: "Missing profile or jobs" },
          { status: 400 },
        );
      }
      // Shortlist only — never full corpus
      const slim = jobs.slice(0, 40).map((j) => ({
        url: j.url,
        title: j.title,
        company: j.company,
        score: j.score ?? null,
        band: j.match?.band ?? null,
        summary: squash(j.summary || "", 160),
      }));
      const key = cacheKey({
        mode: "rerank",
        name: profile.candidate.name,
        titles: profile.target_titles,
        jobs: slim.map((j) => j.url),
      });
      if (!byok) {
        const cached = await readCache(key);
        if (
          cached &&
          typeof cached === "object" &&
          cached !== null &&
          "ordered_urls" in cached
        ) {
          return NextResponse.json({
            ok: true,
            cached: true,
            byok: false,
            ...(cached as {
              ordered_urls: string[];
              notes: Record<string, string>;
            }),
          });
        }
      }

      const prompt = `Re-rank this shortlist for the candidate. Return JSON only:
{ "ordered_urls": ["url1","url2",...], "notes": { "url": "one-line why this rank" } }
Put best fits first. Do not invent URLs. Keep every input URL exactly once.
Candidate: ${profile.candidate.name}
Titles: ${profile.target_titles.join(", ")}
Skills: ${profile.skills_positive.slice(0, 12).join(", ")}
Shortlist: ${JSON.stringify(slim)}`;

      const text = await callGemini(prompt, geminiKey);
      const parsed = JSON.parse(text) as {
        ordered_urls?: string[];
        notes?: Record<string, string>;
      };
      const inputUrls = slim.map((j) => j.url);
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const u of parsed.ordered_urls || []) {
        if (inputUrls.includes(u) && !seen.has(u)) {
          seen.add(u);
          ordered.push(u);
        }
      }
      for (const u of inputUrls) {
        if (!seen.has(u)) ordered.push(u);
      }
      const notes: Record<string, string> = {};
      for (const [u, n] of Object.entries(parsed.notes || {})) {
        if (inputUrls.includes(u) && typeof n === "string") {
          notes[u] = n.slice(0, 220);
        }
      }
      const payload = { ordered_urls: ordered, notes };
      if (!byok) {
        await writeCache(key, payload);
      }
      return NextResponse.json({ ok: true, cached: false, byok, ...payload });
    }

    if (mode === "cover") {
      const profile = body.profile as Profile;
      const job = body.job as Job;
      if (!profile || !job) {
        return NextResponse.json(
          { ok: false, error: "Missing profile or job" },
          { status: 400 },
        );
      }
      const prompt = `Write a short 3-paragraph cover/outreach draft (plain text in JSON { "draft": "..." }). No lies. Candidate ${profile.candidate.name}, titles ${profile.target_titles.join(", ")}, job ${job.title} at ${job.company}. Summary: ${squash(job.summary || "", 300)}`;
      const text = await callGemini(prompt, geminiKey);
      const parsed = JSON.parse(text) as { draft?: string };
      return NextResponse.json({
        ok: true,
        byok,
        draft: parsed.draft || text,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown mode. Use profile | matches | rerank | cover." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Polish failed",
      },
      { status: 500 },
    );
  }
}

/** Readiness probe — does not call Gemini. */
export async function GET() {
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    ready: configured,
    configured,
    byok_supported: true,
    method: "POST",
    note: configured
      ? "POST JSON to polish. Pass geminiKey in body or X-Gemini-Key header for BYOK."
      : "Optional — paste your Gemini key in the app or set GEMINI_API_KEY on the server.",
  });
}

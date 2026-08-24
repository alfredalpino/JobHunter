"use client";

import { useEffect, useMemo, useState } from "react";
import {
  downloadText,
  getJobStatus,
  jobsToMarkdown,
  loadAppliedMap,
  setJobStatus,
  todaysQueue,
} from "@/lib/applied";
import { getRegion } from "@/lib/config";
import { DATE_WINDOWS, defaultPreferences, maxDaysForWindow } from "@/lib/preferences";
import { clearSession, loadSession, saveSession } from "@/lib/storage";
import type {
  AppliedRecord,
  DateWindowId,
  HuntSourceResult,
  Job,
  JobStatus,
  Preferences,
  Profile,
} from "@/lib/types";
import { parsePreferencesYaml, preferencesToYaml } from "@/lib/yaml";

type RegionOpt = { id: string; label: string };
type Step = 1 | 2 | 3 | 4;

export function HuntApp() {
  const [step, setStep] = useState<Step>(1);
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [name, setName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences("dubai"));
  const [yamlText, setYamlText] = useState(
    preferencesToYaml(defaultPreferences("dubai")),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<HuntSourceResult[]>([]);
  const [fetched, setFetched] = useState(0);
  const [huntedAt, setHuntedAt] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, AppliedRecord>>({});
  const [showBandC, setShowBandC] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [useAi, setUseAi] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateWindowId>("any_age");
  const [fitFilter, setFitFilter] = useState<"eligible" | "all">("eligible");

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data) => setRegions(data.regions ?? []))
      .catch(() => setError("Could not load regions."));

    const saved = loadSession();
    setApplied(loadAppliedMap());
    if (saved?.profile) {
      setProfile(saved.profile);
      setName(saved.name || saved.profile.candidate.name);
      if (saved.preferences) {
        setPrefs(saved.preferences);
        setYamlText(preferencesToYaml(saved.preferences));
        if (saved.preferences.date_window) {
          setDateFilter(saved.preferences.date_window);
        }
      }
      if (saved.region) {
        setPrefs((p) => ({ ...p, region: saved.region }));
      }
      if (saved.results?.length) {
        setAllJobs(saved.results);
        setHuntedAt(saved.huntedAt);
        setStep(4);
      } else {
        setStep(2);
      }
      if (saved.showBandC) setShowBandC(true);
    }
  }, []);

  const yamlPreview = useMemo(() => preferencesToYaml(prefs), [prefs]);

  const visibleJobs = useMemo(() => {
    let list = allJobs;

    // 1) Fit filter (eligible vs all scraped)
    if (fitFilter === "eligible") {
      list = list.filter((j) => j.eligible);
    }

    // 2) Date window (client-side only — pool already has every age)
    const w = DATE_WINDOWS.find((d) => d.id === dateFilter);
    if (w && dateFilter !== "any_age") {
      list = list.filter((j) => {
        const age = j.posted_age_days;
        if (age == null) {
          return dateFilter === "all_fresh" || dateFilter === "one_month";
        }
        return age >= w.minDays && age <= w.maxDays;
      });
    }

    // 3) Band C (only hides weak eligible matches)
    if (!showBandC && fitFilter === "eligible") {
      list = list.filter((j) => j.match?.band !== "C");
    }

    // 4) Apply status
    if (statusFilter !== "all") {
      list = list.filter((j) => getJobStatus(j.url, applied) === statusFilter);
    }

    return list;
  }, [allJobs, showBandC, statusFilter, applied, dateFilter, fitFilter]);

  const today10 = useMemo(
    () => todaysQueue(visibleJobs, applied, 10),
    [visibleJobs, applied],
  );

  const byBucket = useMemo(() => {
    const groups: Record<string, Job[]> = {
      last_7_days: [],
      days_8_to_14: [],
      days_15_to_21: [],
      days_22_to_30: [],
      older: [],
      unknown: [],
    };
    for (const j of visibleJobs) {
      const b = j.recency_bucket || "unknown";
      if (groups[b]) groups[b].push(j);
      else groups.unknown.push(j);
    }
    return groups;
  }, [visibleJobs]);

  const eligibleTotal = useMemo(
    () => allJobs.filter((j) => j.eligible).length,
    [allJobs],
  );

  function syncPrefs(next: Preferences) {
    setPrefs(next);
    setYamlText(preferencesToYaml(next));
    saveSession({ preferences: next, region: next.region });
  }

  function onNewCandidate() {
    clearSession();
    setProfile(null);
    setAllJobs([]);
    setSources([]);
    setFetched(0);
    setHuntedAt(null);
    setName("");
    setResumeText("");
    setFile(null);
    setPrefs(defaultPreferences("dubai"));
    setYamlText(preferencesToYaml(defaultPreferences("dubai")));
    setStatus(null);
    setError(null);
    setStep(1);
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("text", resumeText);
      if (file) form.set("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Analyze failed");
      }
      let p = data.profile as Profile;

      if (useAi) {
        setStatus("Polishing profile with AI…");
        const polish = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "profile", profile: p }),
        });
        const pdata = await polish.json();
        if (polish.ok && pdata.ok && pdata.profile) {
          p = pdata.profile as Profile;
          setStatus(pdata.message || "Profile polished with AI.");
        } else if (!polish.ok) {
          setStatus(
            data.message +
              (pdata.error ? ` (AI skipped: ${pdata.error})` : " (AI skipped)"),
          );
        }
      } else {
        setStatus(data.message);
      }

      setProfile(p);
      const next = {
        ...prefs,
        target_titles: p.target_titles.slice(0, 6),
        must_have_skills: p.skills_positive.slice(0, 8),
      };
      if (!next.locations.length) {
        const pack = getRegion(next.region);
        next.locations = pack ? [...pack.locations] : [];
      }
      syncPrefs(next);
      saveSession({ name: p.candidate.name, profile: p, preferences: next });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  function onRegionChange(id: string) {
    const pack = getRegion(id);
    syncPrefs({
      ...prefs,
      region: id,
      locations: pack ? [...pack.locations] : prefs.locations,
      country_indeed: pack?.country_indeed || prefs.country_indeed,
    });
  }

  function onDateWindowChange(id: DateWindowId) {
    setDateFilter(id);
    syncPrefs({
      ...prefs,
      date_window: id,
      recency_max_days: maxDaysForWindow(id),
    });
  }

  function applyYaml() {
    try {
      const parsed = parsePreferencesYaml(yamlText);
      syncPrefs(parsed);
      if (parsed.date_window) setDateFilter(parsed.date_window);
      setStatus("Preferences loaded from YAML.");
    } catch {
      setError("Could not parse preferences YAML.");
    }
  }

  function updateProfileField(patch: Partial<Profile>) {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    saveSession({ profile: next });
  }

  async function onHunt() {
    if (!profile) {
      setError("Analyze a resume first.");
      setStep(1);
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Loading all public job listings…");
    try {
      const huntPrefs = {
        ...prefs,
        date_window: "any_age" as DateWindowId,
        recency_max_days: 99999,
      };
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          preferences: huntPrefs,
          region: huntPrefs.region,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Hunt failed");
      }
      let combined: Job[] = Array.isArray(data.jobs)
        ? (data.jobs as Job[])
        : [
            ...(data.buckets?.last_7_days || []),
            ...(data.buckets?.days_8_to_14 || []),
            ...(data.buckets?.days_15_to_21 || []),
            ...(data.buckets?.days_22_to_30 || []),
            ...(data.buckets?.older || []),
            ...(data.buckets?.unknown || []),
          ];

      if (useAi && combined.filter((j) => j.eligible).length) {
        setStatus("Adding AI match notes for top eligible roles…");
        const top = combined.filter((j) => j.eligible).slice(0, 15);
        const polish = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "matches",
            profile,
            jobs: top,
          }),
        });
        const pdata = await polish.json();
        if (polish.ok && pdata.ok && Array.isArray(pdata.jobs)) {
          const notes = new Map(
            (pdata.jobs as Job[]).map((j) => [j.url, j]),
          );
          combined = combined.map((j) => {
            const n = notes.get(j.url);
            return n
              ? { ...j, ai_note: n.ai_note, ai_bullets: n.ai_bullets }
              : j;
          });
        }
      }

      setAllJobs(combined);
      setSources(data.sources || []);
      setFetched(data.fetched || combined.length);
      setDateFilter("any_age");
      const elig = combined.filter((j) => j.eligible).length;
      // If nothing matches the resume tightly, show the full scrape so user isn't blank
      setFitFilter(elig > 0 ? "eligible" : "all");
      const when = new Date().toISOString();
      setHuntedAt(when);
      saveSession({
        results: combined,
        huntedAt: when,
        preferences: { ...huntPrefs, date_window: "any_age" },
        profile,
        showBandC,
      });
      setStatus(
        elig > 0
          ? `Loaded ${combined.length} listings · ${elig} eligible for your profile. Filter by date below. No auto-apply.`
          : `Loaded ${combined.length} listings · 0 tight matches for your titles — showing all scraped jobs. Tighten titles or keep browsing. No auto-apply.`,
      );
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hunt failed");
    } finally {
      setBusy(false);
    }
  }

  function mark(url: string, st: JobStatus) {
    const next = setJobStatus(url, st, applied);
    setApplied(next);
  }

  function wrongFit(kind: "seniority" | "field", job: Job) {
    const extra =
      kind === "seniority"
        ? ["senior", "sr.", "staff", "principal", "director"]
        : job.title
            .toLowerCase()
            .split(/[^a-z0-9+]+/)
            .filter((w) => w.length > 4)
            .slice(0, 3);
    const next = {
      ...prefs,
      exclude_titles: [
        ...new Set([...(prefs.exclude_titles || []), ...extra]),
      ],
    };
    syncPrefs(next);
    mark(job.url, "skipped");
    setStatus(
      kind === "seniority"
        ? "Noted wrong seniority — added senior signals to excludes."
        : "Noted wrong field — added title tokens to excludes for next hunt.",
    );
  }

  function exportMd() {
    const md = jobsToMarkdown(
      visibleJobs,
      applied,
      `Eligible jobs — ${profile?.candidate.name || "candidate"}`,
    );
    downloadText(
      `eligible-${(profile?.candidate.name || "jobs").replace(/\s+/g, "-").toLowerCase()}.md`,
      md,
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-sand-muted">
          {(
            [
              [1, "Resume"],
              [2, "Region"],
              [3, "Preferences"],
              [4, "Results"],
            ] as const
          ).map(([n, label]) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => setStep(n)}
                className={`focus-ring rounded-full px-3 py-1.5 ${
                  step === n ? "bg-seafoam/20 text-seafoam" : "hover:text-sand"
                }`}
              >
                {n}. {label}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onNewCandidate}
          className="focus-ring rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-sand-muted hover:text-sand"
        >
          New candidate
        </button>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-seafoam" role="status">
          {status}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
            1. Analyze resume
          </h2>
          <p className="mt-2 text-sm text-sand-muted">
            Paste CV text or upload PDF/TXT. Local parse by default — optional AI
            polish uses a little Gemini credit.
          </p>
          <form onSubmit={onAnalyze} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="text-sand-muted">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand placeholder:text-sand-muted/50"
              />
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Resume file (PDF or TXT)</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="focus-ring mt-1 block w-full text-sm text-sand-muted file:mr-3 file:rounded-full file:border-0 file:bg-seafoam/20 file:px-3 file:py-1.5 file:text-seafoam"
              />
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Or paste resume text</span>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={10}
                placeholder="Paste your CV here…"
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 font-mono text-xs text-sand placeholder:text-sand-muted/50"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-sand-muted">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
              />
              Polish with AI (uses a little credit — needs GEMINI_API_KEY)
            </label>
            <button
              type="submit"
              disabled={busy}
              className="focus-ring rounded-full bg-copper px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy ? "Analyzing…" : "Analyze resume"}
            </button>
          </form>
        </section>
      ) : null}

      {step === 2 && profile ? (
        <section className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
            2. Confirm profile & region
          </h2>
          <p className="mt-2 text-sm text-sand-muted">
            Edit what we extracted before hunting — bad parse should never silently
            ruin results.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="text-sand-muted">Target titles (comma-separated)</span>
              <input
                value={profile.target_titles.join(", ")}
                onChange={(e) =>
                  updateProfileField({
                    target_titles: splitCsv(e.target.value),
                    search_queries: splitCsv(e.target.value).slice(0, 4),
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-sand-muted">Skills</span>
              <input
                value={profile.skills_positive.join(", ")}
                onChange={(e) =>
                  updateProfileField({
                    skills_positive: splitCsv(e.target.value),
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              />
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Max years required (cap)</span>
              <input
                type="number"
                min={1}
                max={15}
                value={profile.experience.max_years_required}
                onChange={(e) =>
                  updateProfileField({
                    experience: {
                      ...profile.experience,
                      max_years_required: Number(e.target.value) || 3,
                    },
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              />
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Max job level</span>
              <select
                value={profile.experience.max_job_level || "mid"}
                onChange={(e) =>
                  updateProfileField({
                    experience: {
                      ...profile.experience,
                      max_job_level: e.target.value,
                    },
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              >
                {["junior", "mid", "senior", "lead", "executive"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Region pack</span>
              <select
                value={prefs.region}
                onChange={(e) => onRegionChange(e.target.value)}
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Locations</span>
              <input
                value={prefs.locations.join(", ")}
                onChange={(e) =>
                  syncPrefs({
                    ...prefs,
                    locations: splitCsv(e.target.value),
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="focus-ring rounded-full border border-[var(--line)] px-4 py-2 text-sm text-sand-muted"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                syncPrefs({
                  ...prefs,
                  target_titles: profile.target_titles.slice(0, 6),
                  must_have_skills: profile.skills_positive.slice(0, 8),
                });
                setStep(3);
              }}
              className="focus-ring rounded-full bg-copper px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Continue to preferences
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
            3. Preferences
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-sand-muted">Posted date window</span>
              <select
                value={dateFilter}
                onChange={(e) =>
                  onDateWindowChange(e.target.value as DateWindowId)
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              >
                {DATE_WINDOWS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Seniority band</span>
              <select
                value={prefs.seniority_band}
                onChange={(e) =>
                  syncPrefs({ ...prefs, seniority_band: e.target.value })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              >
                {["intern", "junior", "mid", "senior", "lead", "executive"].map(
                  (b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sand-muted">Work mode</span>
              <select
                value={prefs.work_mode}
                onChange={(e) =>
                  syncPrefs({
                    ...prefs,
                    work_mode: e.target.value as Preferences["work_mode"],
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              >
                {["any", "remote", "hybrid", "onsite"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-sand-muted">Exclude titles</span>
              <input
                value={prefs.exclude_titles.join(", ")}
                onChange={(e) =>
                  syncPrefs({
                    ...prefs,
                    exclude_titles: splitCsv(e.target.value),
                  })
                }
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-sand-muted md:col-span-2">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
              />
              AI match notes on top roles after hunt
            </label>
          </div>

          <div className="mt-6">
            <textarea
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              rows={8}
              className="focus-ring w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 font-mono text-xs text-seafoam"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setYamlText(yamlPreview)}
                className="focus-ring rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-sand-muted"
              >
                Refresh YAML
              </button>
              <button
                type="button"
                onClick={applyYaml}
                className="focus-ring rounded-full border border-seafoam/40 px-3 py-1.5 text-xs text-seafoam"
              >
                Apply YAML
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="focus-ring rounded-full border border-[var(--line)] px-4 py-2 text-sm text-sand-muted"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy || !profile}
              onClick={onHunt}
              className="focus-ring rounded-full bg-copper px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {busy ? "Hunting…" : "Run job hunt"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-8">
          <div className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6">
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
              4. Eligible jobs
            </h2>
            <p className="mt-2 text-sm text-sand-muted">
              Load all scraped jobs first · filter date / fit here · track
              applied · no auto-apply.
            </p>
            <p className="mt-3 text-sm text-seafoam">
              {visibleJobs.length} showing · {eligibleTotal} eligible ·{" "}
              {allJobs.length || fetched} loaded
              {huntedAt ? ` · ${new Date(huntedAt).toLocaleString()}` : ""}
            </p>

            {!allJobs.length ? (
              <p className="mt-4 rounded-xl border border-[var(--line)] bg-ink/40 px-4 py-3 text-sm text-sand-muted">
                No listings loaded yet — run a hunt.
              </p>
            ) : null}
            {allJobs.length > 0 && visibleJobs.length === 0 ? (
              <p className="mt-4 rounded-xl border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper">
                Filters hid everything. Switch Fit to{" "}
                <strong>All scraped</strong>, Date to{" "}
                <strong>Any age</strong>, or enable <strong>Show band C</strong>.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <label className="text-xs text-sand-muted">
                Fit{" "}
                <select
                  value={fitFilter}
                  onChange={(e) =>
                    setFitFilter(e.target.value as "eligible" | "all")
                  }
                  className="ml-1 rounded-lg border border-[var(--line)] bg-ink px-2 py-1 text-sand"
                >
                  <option value="eligible">Eligible only</option>
                  <option value="all">All scraped</option>
                </select>
              </label>
              <label className="text-xs text-sand-muted">
                Date filter{" "}
                <select
                  value={dateFilter}
                  onChange={(e) =>
                    onDateWindowChange(e.target.value as DateWindowId)
                  }
                  className="ml-1 rounded-lg border border-[var(--line)] bg-ink px-2 py-1 text-sand"
                >
                  {DATE_WINDOWS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-sand-muted">
                Status{" "}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | JobStatus)
                  }
                  className="ml-1 rounded-lg border border-[var(--line)] bg-ink px-2 py-1 text-sand"
                >
                  {[
                    "all",
                    "new",
                    "saved",
                    "ready",
                    "applied",
                    "skipped",
                    "ghosted",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs text-sand-muted">
                <input
                  type="checkbox"
                  checked={showBandC}
                  onChange={(e) => {
                    setShowBandC(e.target.checked);
                    saveSession({ showBandC: e.target.checked });
                  }}
                />
                Show band C
              </label>
            </div>

            {sources.length ? (
              <ul className="mt-4 flex flex-wrap gap-2 text-xs text-sand-muted">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    className={`rounded-full border px-2.5 py-1 ${
                      s.ok
                        ? "border-[var(--line)]"
                        : "border-copper/40 text-copper"
                    }`}
                  >
                    {s.name}: {s.ok ? s.count : "error"}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="focus-ring rounded-full border border-[var(--line)] px-4 py-2 text-sm text-sand-muted"
              >
                Edit preferences
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onHunt}
                className="focus-ring rounded-full bg-copper px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
              >
                {busy ? "Hunting…" : "Hunt again"}
              </button>
              <button
                type="button"
                onClick={exportMd}
                className="focus-ring rounded-full border border-seafoam/40 px-4 py-2 text-sm text-seafoam"
              >
                Export markdown
              </button>
            </div>
          </div>

          <ResultsBucket
            title="Today's 10 — apply these first"
            jobs={today10}
            empty="Queue clear — hunt again or show band C."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
            highlight
          />

          <ResultsBucket
            title="This week (0–7 days)"
            jobs={byBucket.last_7_days}
            empty="No roles in the last 7 days for this filter."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
          <ResultsBucket
            title="Last week (8–14 days)"
            jobs={byBucket.days_8_to_14}
            empty="No roles in the 8–14 day window."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
          <ResultsBucket
            title="2–3 weeks ago (15–21 days)"
            jobs={byBucket.days_15_to_21}
            empty="No roles in the 15–21 day window."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
          <ResultsBucket
            title="3–4 weeks ago (22–30 days)"
            jobs={byBucket.days_22_to_30}
            empty="No roles in the 22–30 day window."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
          <ResultsBucket
            title="Older than 30 days"
            jobs={byBucket.older}
            empty="No older dated roles in this view."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
          <ResultsBucket
            title="Unknown / missing post date"
            jobs={byBucket.unknown}
            empty="No undated roles in this view."
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
          />
        </section>
      ) : null}
    </div>
  );
}

function splitCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function ResultsBucket({
  title,
  jobs,
  empty,
  applied,
  onMark,
  onWrongFit,
  highlight,
}: {
  title: string;
  jobs: Job[];
  empty: string;
  applied: Record<string, AppliedRecord>;
  onMark: (url: string, st: JobStatus) => void;
  onWrongFit: (kind: "seniority" | "field", job: Job) => void;
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-copper/50 bg-copper/5"
          : "border-[var(--line)] bg-ink-mid/40"
      }`}
    >
      <h3 className="text-lg font-medium text-sand">{title}</h3>
      {!jobs.length ? (
        <p className="mt-4 text-sm text-sand-muted">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {jobs.map((job) => {
            const st = getJobStatus(job.url, applied);
            return (
              <li
                key={job.url}
                className="rounded-xl border border-[var(--line)] bg-ink/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.match?.band ? (
                        <span className="rounded-full bg-seafoam/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-seafoam">
                          Band {job.match.band}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-sand-muted">
                        {st}
                      </span>
                    </div>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onMark(job.url, "ready")}
                      className="focus-ring mt-1 block text-base font-medium text-copper hover:underline"
                    >
                      {job.title}
                    </a>
                    <p className="mt-1 text-sm text-sand">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-sand-muted">
                      {job.portal}
                      {job.posted_age_days != null
                        ? ` · ~${job.posted_age_days}d`
                        : ""}
                      {job.score != null ? ` · score ${job.score}` : ""}
                    </p>
                    {job.match ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.match.title_matched.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-seafoam/10 px-2 py-0.5 text-[11px] text-seafoam"
                          >
                            title: {t}
                          </span>
                        ))}
                        {job.match.skills_matched.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-ink-mid px-2 py-0.5 text-[11px] text-sand-muted"
                          >
                            skill: {s}
                          </span>
                        ))}
                        {job.match.geo_matched ? (
                          <span className="rounded-full bg-ink-mid px-2 py-0.5 text-[11px] text-sand-muted">
                            geo match
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {job.ai_note ? (
                      <p className="mt-2 text-sm text-seafoam">{job.ai_note}</p>
                    ) : null}
                    {job.ai_bullets?.length ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-sand-muted">
                        {job.ai_bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                    {job.reject_reason && !job.eligible ? (
                      <p className="mt-1 text-[11px] text-copper">
                        Not eligible: {job.reject_reason}
                      </p>
                    ) : null}
                    {job.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm text-sand-muted">
                        {job.summary}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onMark(job.url, "ready")}
                      className="focus-ring rounded-full border border-seafoam/40 px-4 py-2 text-center text-xs font-medium text-seafoam"
                    >
                      Open listing
                    </a>
                    <button
                      type="button"
                      onClick={() => onMark(job.url, "applied")}
                      className="focus-ring rounded-full bg-copper/90 px-4 py-2 text-xs font-semibold text-ink"
                    >
                      Mark applied
                    </button>
                    <button
                      type="button"
                      onClick={() => onMark(job.url, "saved")}
                      className="focus-ring rounded-full border border-[var(--line)] px-4 py-1.5 text-xs text-sand-muted"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => onWrongFit("seniority", job)}
                      className="focus-ring text-left text-[11px] text-sand-muted underline"
                    >
                      Wrong seniority
                    </button>
                    <button
                      type="button"
                      onClick={() => onWrongFit("field", job)}
                      className="focus-ring text-left text-[11px] text-sand-muted underline"
                    >
                      Wrong field
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

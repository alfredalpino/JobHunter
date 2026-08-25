"use client";

import { useEffect, useMemo, useState } from "react";
import {
  downloadText,
  loadAppliedMap,
  setJobStatus,
} from "@/lib/applied";
import {
  DRIP_BATCH,
  advanceDripCursor,
  dripBatch,
  dripEligibleQueue,
} from "@/lib/drip";
import { buildHuntQueries } from "@/lib/huntQueries";
import {
  clearGeminiKey,
  loadAiPolishPref,
  loadGeminiKey,
  saveAiPolishPref,
  saveGeminiKey,
} from "@/lib/geminiKey";
import { HuntFilters } from "@/components/hunt/HuntFilters";
import { HuntResults } from "@/components/hunt/HuntResults";
import { HuntSearchHeader } from "@/components/hunt/HuntSearchHeader";
import { ProfileRail } from "@/components/hunt/ProfileRail";
import { ResumePanel } from "@/components/hunt/ResumePanel";
import { getRegion } from "@/lib/config";
import { defaultPreferences, maxDaysForWindow } from "@/lib/preferences";
import {
  applyJobFilters,
  jobLevelToSeniorityBand,
  mergeProfileIntoPrefs,
  partitionJobsByBucket,
  seniorityBandToJobLevel,
  splitKeywordListInput,
  splitListInput,
} from "@/lib/filters";
import {
  applyTitlesToProfile,
  buildMinimalProfileFromTitles,
  parseTitleKeywords,
} from "@/lib/searchProfile";
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

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function HuntApp() {
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
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [serverAiReady, setServerAiReady] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateWindowId>("all_fresh");
  const [fitFilter, setFitFilter] = useState<"eligible" | "all">("eligible");
  const [excludeInput, setExcludeInput] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [dripCursor, setDripCursor] = useState(0);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [huntSource, setHuntSource] = useState<"index" | "live_scrape" | null>(
    null,
  );
  const [titlesInput, setTitlesInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRegions(data.regions ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load regions.");
      });

    fetch("/api/polish")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setServerAiReady(Boolean(data.configured));
      })
      .catch(() => {
        /* optional */
      });

    setGeminiKey(loadGeminiKey());
    setUseAi(loadAiPolishPref());

    /* eslint-disable react-hooks/set-state-in-effect -- intentional post-mount localStorage sync */
    const saved = loadSession();
    const appliedMap = loadAppliedMap();
    setApplied(appliedMap);

    const canRestore =
      saved?.profile &&
      saved.results?.length &&
      saved.huntedAt &&
      Date.now() - new Date(saved.huntedAt).getTime() < SESSION_MAX_AGE_MS;

    if (canRestore && saved) {
      const nextPrefs =
        saved.preferences || defaultPreferences(saved.region || "dubai");
      setProfile(saved.profile);
      setName(saved.profile?.candidate?.name || saved.name || "");
      setAllJobs(saved.results || []);
      setHuntedAt(saved.huntedAt);
      setPrefs(nextPrefs);
      setYamlText(preferencesToYaml(nextPrefs));
      setExcludeInput((nextPrefs.exclude_titles || []).join(", "));
      setTitlesInput(
        (
          saved.profile?.target_titles ||
          nextPrefs.target_titles ||
          []
        ).join(", "),
      );
      setShowBandC(saved.showBandC ?? false);
      setDripCursor(saved.dripCursor ?? 0);
      setShowAllMatches(saved.showAllMatches ?? false);
      setHuntSource(saved.huntSource ?? null);
      setDateFilter(nextPrefs.date_window || "all_fresh");
      setStatus("Restored your last hunt from this browser.");
    } else {
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
      setExcludeInput("");
      setTitlesInput("");
      setStatus(null);
    }
    setError(null);
    setSelectedUrls(new Set());
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!allJobs.length) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [allJobs.length]);

  const filterSummary = useMemo(() => {
    const parts = [`fit:${fitFilter}`, `date:${dateFilter}`];
    if (prefs.work_mode && prefs.work_mode !== "any") {
      parts.push(`work:${prefs.work_mode}`);
    }
    if (statusFilter !== "all") parts.push(`status:${statusFilter}`);
    if (showBandC) parts.push("bandC:on");
    return parts.join(", ");
  }, [fitFilter, dateFilter, statusFilter, showBandC, prefs.work_mode]);

  function toggleSelected(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedUrls(new Set(visibleJobs.map((j) => j.url).filter(Boolean)));
  }

  function clearSelection() {
    setSelectedUrls(new Set());
  }

  function downloadPrefsYaml() {
    downloadText(
      `preferences-${prefs.region}-${new Date().toISOString().slice(0, 10)}.yaml`,
      preferencesToYaml(prefs),
      "text/yaml;charset=utf-8",
    );
    setStatus("Preferences YAML downloaded.");
  }

  function commitExcludeTitles(nextRaw = excludeInput): string[] {
    const parsed = splitKeywordListInput(nextRaw);
    setExcludeInput(nextRaw);
    syncPrefs({ ...prefs, exclude_titles: parsed });
    return parsed;
  }

  const yamlPreview = useMemo(() => preferencesToYaml(prefs), [prefs]);

  const visibleJobs = useMemo(
    () =>
      applyJobFilters(allJobs, {
        fitFilter,
        dateFilter,
        showBandC,
        statusFilter,
        applied,
        workModeFilter: prefs.work_mode,
      }),
    [allJobs, showBandC, statusFilter, applied, dateFilter, fitFilter, prefs.work_mode],
  );

  const dripQueue = useMemo(
    () => dripEligibleQueue(visibleJobs, applied),
    [visibleJobs, applied],
  );

  const drip = useMemo(
    () => dripBatch(dripQueue, dripCursor, DRIP_BATCH),
    [dripQueue, dripCursor],
  );

  const today10 = drip.batch;

  const byBucket = useMemo(
    () => partitionJobsByBucket(visibleJobs),
    [visibleJobs],
  );

  const eligibleTotal = useMemo(
    () => allJobs.filter((j) => j.eligible).length,
    [allJobs],
  );

  function syncPrefs(next: Preferences) {
    setPrefs(next);
    setYamlText(preferencesToYaml(next));
    saveSession({ preferences: next, region: next.region });
  }

  function syncProfileAndPrefs(nextProfile: Profile, basePrefs = prefs) {
    setProfile(nextProfile);
    setTitlesInput((nextProfile.target_titles || []).join(", "));
    const merged = mergeProfileIntoPrefs(nextProfile, basePrefs);
    syncPrefs(merged);
    setExcludeInput((merged.exclude_titles || []).join(", "));
    saveSession({ profile: nextProfile, preferences: merged });
  }

  /** Commit search-bar titles into profile + prefs (creates minimal profile if needed). */
  function commitTitles(raw = titlesInput): Profile | null {
    const titles = parseTitleKeywords(raw);
    setTitlesInput(titles.join(", "));
    if (!titles.length) {
      if (profile) {
        const next = applyTitlesToProfile(profile, []);
        syncProfileAndPrefs(next, { ...prefs, target_titles: [] });
        return next;
      }
      return null;
    }

    if (profile) {
      const next = applyTitlesToProfile(profile, titles);
      syncProfileAndPrefs(next, { ...prefs, target_titles: titles });
      return next;
    }

    try {
      const minimal = buildMinimalProfileFromTitles({
        titles,
        name,
        regionId: prefs.region,
        locations: prefs.locations,
      });
      syncProfileAndPrefs(minimal, {
        ...prefs,
        target_titles: titles,
        seniority_band: "mid",
      });
      return minimal;
    } catch {
      return null;
    }
  }

  function ensureHuntProfile(): Profile | null {
    const titles = parseTitleKeywords(titlesInput);
    if (profile) {
      if (titles.length) {
        return commitTitles(titlesInput) || profile;
      }
      if (profile.target_titles?.length) return profile;
      setError("Enter at least one job title in the search bar.");
      return null;
    }
    if (!titles.length) {
      setError("Type a job title above, or analyze a resume first.");
      return null;
    }
    return commitTitles(titlesInput);
  }

  function onDateWindowChange(id: DateWindowId) {
    setDateFilter(id);
    syncPrefs({
      ...prefs,
      date_window: id,
      recency_max_days: maxDaysForWindow(id),
    });
  }

  function resetResultFilters() {
    const windowId = prefs.date_window || "all_fresh";
    setDateFilter(windowId);
    setFitFilter("eligible");
    setStatusFilter("all");
    setShowBandC(false);
    syncPrefs({ ...prefs, work_mode: "any" });
    saveSession({ showBandC: false });
  }

  function onWorkModeChange(mode: Preferences["work_mode"]) {
    syncPrefs({ ...prefs, work_mode: mode });
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
    setDateFilter("all_fresh");
    setFitFilter("eligible");
    setStatusFilter("all");
    setShowBandC(false);
    setExcludeInput("");
    setDripCursor(0);
    setShowAllMatches(false);
    setHuntSource(null);
    setSelectedUrls(new Set());
    setTitlesInput("");
  }

  function polishPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const key = geminiKey.trim();
    return key ? { ...payload, geminiKey: key } : payload;
  }

  function onGeminiKeyChange(value: string) {
    setGeminiKey(value);
    saveGeminiKey(value);
  }

  function onUseAiChange(checked: boolean) {
    setUseAi(checked);
    saveAiPolishPref(checked);
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
          body: JSON.stringify(polishPayload({ mode: "profile", profile: p })),
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

      const cleaned = {
        ...p,
        target_titles: splitListInput(p.target_titles.join("\n")),
        skills_positive: splitListInput(p.skills_positive.join(", ")),
        experience: {
          ...p.experience,
          max_job_level:
            p.experience.max_job_level ||
            seniorityBandToJobLevel(p.experience.seniority_band),
        },
      };
      // Prefer titles already typed in the search bar when analyze returns empty/weak set.
      const typed = parseTitleKeywords(titlesInput);
      if (typed.length && cleaned.target_titles.length === 0) {
        cleaned.target_titles = typed;
        cleaned.search_queries = buildHuntQueries(cleaned).slice(0, 6);
      }
      setProfile(cleaned);
      setTitlesInput(cleaned.target_titles.join(", "));
      const next = mergeProfileIntoPrefs(cleaned, {
        ...defaultPreferences("dubai"),
        ...(typed.length ? { target_titles: typed } : {}),
        region: prefs.region,
        locations: prefs.locations,
        work_mode: prefs.work_mode,
      });
      syncPrefs(next);
      setExcludeInput((next.exclude_titles || []).join(", "));
      saveSession({
        name: cleaned.candidate.name,
        profile: cleaned,
        preferences: next,
      });
      if (!useAi) {
        setStatus(
          data.message ||
            "Resume analyzed — tweak titles above and hunt when ready.",
        );
      }
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

  function applyYaml() {
    try {
      const parsed = parsePreferencesYaml(yamlText);
      syncPrefs(parsed);
      if (parsed.date_window) setDateFilter(parsed.date_window);
      setExcludeInput((parsed.exclude_titles || []).join(", "));
      setStatus("Preferences loaded from YAML.");
    } catch {
      setError("Could not parse preferences YAML.");
    }
  }

  function updateProfileField(patch: Partial<Profile>) {
    if (!profile) return;
    const next = { ...profile, ...patch };
    if (patch.candidate) {
      next.candidate = { ...profile.candidate, ...patch.candidate };
    }
    if (patch.target_titles) {
      next.target_titles = splitListInput(patch.target_titles.join("\n"));
      next.search_queries = buildHuntQueries(next).slice(0, 6);
      setTitlesInput(next.target_titles.join(", "));
    }
    if (patch.skills_positive) {
      next.skills_positive = splitListInput(patch.skills_positive.join(", "));
    }
    if (patch.experience?.max_job_level) {
      syncProfileAndPrefs(next, {
        ...prefs,
        seniority_band: jobLevelToSeniorityBand(patch.experience.max_job_level),
      });
      return;
    }
    syncProfileAndPrefs(next);
  }

  function onSeniorityBandChange(band: string) {
    if (!profile) return;
    const maxLevel = seniorityBandToJobLevel(band);
    syncProfileAndPrefs(
      {
        ...profile,
        experience: {
          ...profile.experience,
          max_job_level: maxLevel,
          seniority_band: band,
        },
      },
      { ...prefs, seniority_band: band },
    );
  }

  async function onHunt() {
    const huntProfile = ensureHuntProfile();
    if (!huntProfile) return;
    setBusy(true);
    setError(null);
    setStatus("Loading all public job listings…");
    try {
      const excludeTitles = splitKeywordListInput(excludeInput);
      if (excludeTitles.join(", ") !== prefs.exclude_titles.join(", ")) {
        syncPrefs({ ...prefs, exclude_titles: excludeTitles });
      }
      const huntPrefs = {
        ...prefs,
        target_titles: huntProfile.target_titles,
        exclude_titles: excludeTitles,
        date_window: "any_age" as DateWindowId,
        recency_max_days: 99999,
      };
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: huntProfile,
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

      const src =
        data.source === "index" || data.source === "live_scrape"
          ? data.source
          : "live_scrape";
      setHuntSource(src);

      if (useAi && combined.filter((j) => j.eligible).length) {
        const eligible = combined.filter((j) => j.eligible);
        setStatus("AI re-ranking shortlist (BYOK / server key)…");
        const shortlist = eligible.slice(0, 40);
        const rerank = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            polishPayload({
              mode: "rerank",
              profile: huntProfile,
              jobs: shortlist,
            }),
          ),
        });
        const rdata = await rerank.json();
        if (
          rerank.ok &&
          rdata.ok &&
          Array.isArray(rdata.ordered_urls) &&
          rdata.ordered_urls.length
        ) {
          const order = rdata.ordered_urls as string[];
          const notes = (rdata.notes || {}) as Record<string, string>;
          const rank = new Map(order.map((u, i) => [u, i]));
          const rest = combined.filter((j) => !rank.has(j.url));
          const ranked = [...shortlist].sort(
            (a, b) =>
              (rank.get(a.url) ?? 999) - (rank.get(b.url) ?? 999),
          );
          combined = [
            ...ranked.map((j) =>
              notes[j.url] ? { ...j, ai_note: notes[j.url] } : j,
            ),
            ...rest,
          ];
        }

        setStatus("Adding AI match notes for top eligible roles…");
        const top = combined.filter((j) => j.eligible).slice(0, 15);
        const polish = await fetch("/api/polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            polishPayload({
              mode: "matches",
              profile: huntProfile,
              jobs: top,
            }),
          ),
        });
        const pdata = await polish.json();
        if (polish.ok && pdata.ok && Array.isArray(pdata.jobs)) {
          const notesMap = new Map(
            (pdata.jobs as Job[]).map((j) => [j.url, j]),
          );
          combined = combined.map((j) => {
            const n = notesMap.get(j.url);
            return n
              ? {
                  ...j,
                  ai_note: n.ai_note || j.ai_note,
                  ai_bullets: n.ai_bullets || j.ai_bullets,
                }
              : j;
          });
        }
      }

      setAllJobs(combined);
      setSources(data.sources || []);
      setFetched(data.fetched || combined.length);
      setDripCursor(0);
      setShowAllMatches(false);
      const resultWindow = prefs.date_window || "all_fresh";
      setDateFilter(resultWindow);
      const elig = combined.filter((j) => j.eligible).length;
      setFitFilter(elig > 0 ? "eligible" : "all");
      const when = new Date().toISOString();
      setHuntedAt(when);
      saveSession({
        results: combined,
        huntedAt: when,
        preferences: { ...huntPrefs, date_window: "any_age" },
        profile: huntProfile,
        showBandC,
        dripCursor: 0,
        showAllMatches: false,
        huntSource: src,
      });
      const srcLabel =
        src === "index"
          ? `index (${data.index_count ?? combined.length})`
          : "live scrape";
      setStatus(
        elig > 0
          ? `Loaded ${combined.length} via ${srcLabel} · ${elig} eligible. Match loop shows 10 at a time. No auto-apply.`
          : `Loaded ${combined.length} via ${srcLabel} · 0 tight matches — showing all. No auto-apply.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hunt failed");
    } finally {
      setBusy(false);
    }
  }

  function mark(url: string, st: JobStatus) {
    const next = setJobStatus(url, st, applied);
    setApplied(next);
    if (st === "applied" || st === "skipped" || st === "ghosted") {
      saveSession({ dripCursor });
    }
  }

  function loadNextDrip() {
    const next = advanceDripCursor(dripCursor, dripQueue.length, DRIP_BATCH);
    setDripCursor(next);
    saveSession({ dripCursor: next });
    setStatus(
      next >= dripQueue.length
        ? "End of match loop — toggle Show all matches for the full list."
        : `Unlocked next ${DRIP_BATCH} matches.`,
    );
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
    setExcludeInput(next.exclude_titles.join(", "));
    mark(job.url, "skipped");
    setStatus(
      kind === "seniority"
        ? "Noted wrong seniority — added senior signals to excludes."
        : "Noted wrong field — added title tokens to excludes for next hunt.",
    );
  }

  return (
    <div className="space-y-6">
      <header className="rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="glass-badge inline-flex px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-seafoam">
            Title-first hunt
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-light tracking-tight text-sand md:text-4xl">
            Find fresh roles that fit you
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-sand-muted">
            Type job titles, pick a region, Hunt. Analyze a resume when you want
            tighter fit — we never auto-apply.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewCandidate}
          className="focus-ring glass-btn-ghost touch-target shrink-0 self-start px-4 py-2.5 text-sm sm:self-auto"
        >
          Start over
        </button>
      </header>

      {error ? (
        <p className="glass-alert px-4 py-3 text-sm text-copper" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="glass-alert-success px-4 py-3 text-sm" role="status">
          {status}
        </p>
      ) : null}

      <HuntSearchHeader
        titlesInput={titlesInput}
        onTitlesInputChange={setTitlesInput}
        onTitlesCommit={() => {
          commitTitles();
        }}
        regionId={prefs.region}
        regions={regions}
        onRegionChange={onRegionChange}
        locations={prefs.locations}
        busy={busy}
        canHunt={
          parseTitleKeywords(titlesInput).length > 0 ||
          Boolean(profile?.target_titles?.length)
        }
        onHunt={onHunt}
        huntSource={huntSource}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-2 lg:max-h-[calc(100svh-1rem)] lg:overflow-y-auto lg:pr-1">
          <ResumePanel
            name={name}
            onNameChange={setName}
            resumeText={resumeText}
            onResumeTextChange={setResumeText}
            onFileChange={setFile}
            busy={busy}
            onAnalyze={onAnalyze}
            useAi={useAi}
            onUseAiChange={onUseAiChange}
            geminiKey={geminiKey}
            onGeminiKeyChange={onGeminiKeyChange}
            showGeminiKey={showGeminiKey}
            onToggleShowGeminiKey={() => setShowGeminiKey((v) => !v)}
            onClearGeminiKey={() => {
              onGeminiKeyChange("");
              clearGeminiKey();
            }}
            serverAiReady={serverAiReady}
            hasProfile={Boolean(profile && profile.source !== "titles")}
          />

          {profile ? (
            <ProfileRail
              profile={profile}
              prefs={prefs}
              regions={regions}
              updateProfileField={updateProfileField}
              onSeniorityBandChange={onSeniorityBandChange}
              onRegionChange={onRegionChange}
              syncPrefs={syncPrefs}
              splitListInput={splitListInput}
              splitKeywordListInput={splitKeywordListInput}
            />
          ) : null}

          <details className="glass-panel group p-4 sm:p-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-sand marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Advanced (YAML preferences)
                <span className="text-xs font-normal text-sand-muted group-open:hidden">
                  Expand
                </span>
                <span className="hidden text-xs font-normal text-sand-muted group-open:inline">
                  Collapse
                </span>
              </span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                rows={8}
                className="focus-ring glass-code w-full px-3 py-2.5 font-mono text-xs text-seafoam"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setYamlText(yamlPreview)}
                  className="focus-ring glass-btn-ghost touch-target px-3 py-2 text-xs"
                >
                  Refresh YAML
                </button>
                <button
                  type="button"
                  onClick={applyYaml}
                  className="focus-ring glass-btn-seafoam touch-target px-3 py-2 text-xs"
                >
                  Apply YAML
                </button>
                <button
                  type="button"
                  onClick={downloadPrefsYaml}
                  className="focus-ring glass-btn-ghost touch-target px-3 py-2 text-xs"
                >
                  Download YAML
                </button>
              </div>
            </div>
          </details>
        </aside>

        <div className="min-w-0 space-y-6">
          <HuntFilters
            prefs={prefs}
            fitFilter={fitFilter}
            onFitFilterChange={setFitFilter}
            dateFilter={dateFilter}
            onDateWindowChange={onDateWindowChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showBandC={showBandC}
            onShowBandCChange={(v) => {
              setShowBandC(v);
              saveSession({ showBandC: v });
            }}
            onWorkModeChange={onWorkModeChange}
            excludeInput={excludeInput}
            onExcludeInputChange={setExcludeInput}
            onExcludeCommit={() => commitExcludeTitles()}
            onMustHaveSkillsChange={(skills) =>
              syncPrefs({ ...prefs, must_have_skills: skills })
            }
            splitKeywordListInput={splitKeywordListInput}
            onResetFilters={resetResultFilters}
          />

          <HuntResults
            allJobs={allJobs}
            visibleJobs={visibleJobs}
            eligibleTotal={eligibleTotal}
            fetched={fetched}
            huntedAt={huntedAt}
            huntSource={huntSource}
            sources={sources}
            today10={today10}
            dripTotal={drip.total}
            dripRemaining={drip.remaining}
            showAllMatches={showAllMatches}
            onToggleShowAll={() => {
              const next = !showAllMatches;
              setShowAllMatches(next);
              saveSession({ showAllMatches: next });
            }}
            onLoadNextDrip={loadNextDrip}
            byBucket={byBucket}
            applied={applied}
            onMark={mark}
            onWrongFit={wrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={toggleSelected}
            onSelectAllVisible={selectAllVisible}
            onClearSelection={clearSelection}
            filterSummary={filterSummary}
            candidateName={profile?.candidate.name}
            onStatus={setStatus}
          />
        </div>
      </div>
    </div>
  );
}

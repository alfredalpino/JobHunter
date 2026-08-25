"use client";

import { ExportPanel } from "@/components/ExportPanel";
import { DRIP_BATCH } from "@/lib/drip";
import { getJobStatus } from "@/lib/applied";
import type {
  AppliedRecord,
  HuntSourceResult,
  Job,
  JobStatus,
} from "@/lib/types";

type HuntResultsProps = {
  allJobs: Job[];
  visibleJobs: Job[];
  eligibleTotal: number;
  fetched: number;
  huntedAt: string | null;
  huntSource: "index" | "live_scrape" | null;
  sources: HuntSourceResult[];
  today10: Job[];
  dripTotal: number;
  dripRemaining: number;
  showAllMatches: boolean;
  onToggleShowAll: () => void;
  onLoadNextDrip: () => void;
  byBucket: Record<string, Job[]>;
  applied: Record<string, AppliedRecord>;
  onMark: (url: string, st: JobStatus) => void;
  onWrongFit: (kind: "seniority" | "field", job: Job) => void;
  selectedUrls: Set<string>;
  onToggleSelect: (url: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  filterSummary: string;
  candidateName?: string;
  onStatus: (msg: string) => void;
};

export function HuntResults({
  allJobs,
  visibleJobs,
  eligibleTotal,
  fetched,
  huntedAt,
  huntSource,
  sources,
  today10,
  dripTotal,
  dripRemaining,
  showAllMatches,
  onToggleShowAll,
  onLoadNextDrip,
  byBucket,
  applied,
  onMark,
  onWrongFit,
  selectedUrls,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection,
  filterSummary,
  candidateName,
  onStatus,
}: HuntResultsProps) {
  return (
    <section className="space-y-6">
      <div className="glass-panel p-4 sm:p-5">
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
          Matches
        </h2>
        <p className="mt-2 text-sm text-sand-muted">
          Match loop shows 10 at a time. Mark applied, skip, or wrong fit —
          then unlock the next batch. We never auto-apply.
        </p>
        <p className="mt-2 flex flex-col gap-1 text-sm text-seafoam sm:block">
          <span>
            {visibleJobs.length} showing · {eligibleTotal} match your profile ·{" "}
            {allJobs.length || fetched} total
            {huntSource
              ? ` · via ${huntSource === "index" ? "shared index" : "live scrape"}`
              : ""}
          </span>
          {huntedAt ? (
            <span className="text-sand-muted">
              Updated {new Date(huntedAt).toLocaleString()}
            </span>
          ) : null}
        </p>

        {!allJobs.length ? (
          <p className="mt-4 glass-inset px-4 py-3 text-sm text-sand-muted">
            No listings yet — set filters and hit Hunt. Resume analysis unlocks
            matching.
          </p>
        ) : null}
        {allJobs.length > 0 && visibleJobs.length === 0 ? (
          <p className="mt-4 glass-alert px-4 py-3 text-sm text-copper">
            Filters hid everything. Switch Fit to <strong>All scraped</strong>,
            Date to <strong>Any age</strong>, Work mode to <strong>Any</strong>,
            or enable <strong>Show band C</strong>.
          </p>
        ) : null}

        {sources.length ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-sand-muted">
              {sources.filter((s) => s.ok && s.count > 0).length} of{" "}
              {sources.length} portals returned jobs
              {sources.some((s) => !s.ok)
                ? ` · ${sources.filter((s) => !s.ok).length} failed`
                : ""}
              .
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Hunt source results">
              {sources.map((s) => (
                <li
                  key={s.id}
                  title={s.error || undefined}
                  className={`glass-badge inline-flex px-2 py-0.5 text-[10px] ${
                    !s.ok
                      ? "text-[#e07070]"
                      : s.count > 0
                        ? "text-seafoam"
                        : "text-sand-muted"
                  }`}
                >
                  {s.name}
                  {s.ok ? ` · ${s.count}` : " · fail"}
                  {s.cached ? " · cached" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="focus-ring glass-btn-ghost px-3 py-1.5 text-xs"
          >
            Select all visible
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="focus-ring glass-btn-ghost px-3 py-1.5 text-xs"
          >
            Clear selection
          </button>
          {selectedUrls.size > 0 ? (
            <span className="self-center text-xs text-sand-muted">
              {selectedUrls.size} selected
            </span>
          ) : null}
        </div>

        <ExportPanel
          visibleJobs={visibleJobs}
          allJobs={allJobs}
          queueJobs={today10}
          selectedUrls={selectedUrls}
          applied={applied}
          candidateName={candidateName}
          filterSummary={filterSummary}
          onStatus={onStatus}
        />
      </div>

      <ResultsBucket
        title={`Match loop · ${today10.length} of ${dripTotal} in queue`}
        jobs={today10}
        empty="No roles in your queue yet — loosen filters or hunt again."
        applied={applied}
        onMark={onMark}
        onWrongFit={onWrongFit}
        highlight
        selectedUrls={selectedUrls}
        onToggleSelect={onToggleSelect}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={dripRemaining <= 0}
          onClick={onLoadNextDrip}
          className="focus-ring glass-btn-seafoam touch-target w-full px-4 py-3 text-sm disabled:opacity-50 sm:w-auto sm:py-2"
        >
          {dripRemaining > 0
            ? `Next ${Math.min(DRIP_BATCH, dripRemaining)} matches`
            : "No more in loop"}
        </button>
        <button
          type="button"
          onClick={onToggleShowAll}
          className="focus-ring glass-btn-ghost touch-target w-full px-4 py-3 text-sm sm:w-auto sm:py-2"
        >
          {showAllMatches ? "Hide full list" : "Show all matches"}
        </button>
        <span className="text-xs text-sand-muted">
          {dripRemaining} remaining after this batch
        </span>
      </div>

      {showAllMatches ? (
        <>
          <ResultsBucket
            title="Posted in the last 7 days"
            jobs={byBucket.last_7_days || []}
            empty="No roles in the last 7 days for this filter."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
          <ResultsBucket
            title="Posted 8–14 days ago"
            jobs={byBucket.days_8_to_14 || []}
            empty="No roles in the 8–14 day window."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
          <ResultsBucket
            title="Posted 15–21 days ago"
            jobs={byBucket.days_15_to_21 || []}
            empty="No roles in the 15–21 day window."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
          <ResultsBucket
            title="Posted 22–30 days ago"
            jobs={byBucket.days_22_to_30 || []}
            empty="No roles in the 22–30 day window."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
          <ResultsBucket
            title="Older than 30 days"
            jobs={byBucket.older || []}
            empty="No older dated roles in this view."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
          <ResultsBucket
            title="Date unknown"
            jobs={byBucket.unknown || []}
            empty="No undated roles in this view."
            applied={applied}
            onMark={onMark}
            onWrongFit={onWrongFit}
            selectedUrls={selectedUrls}
            onToggleSelect={onToggleSelect}
          />
        </>
      ) : null}
    </section>
  );
}

function ResultsBucket({
  title,
  jobs,
  empty,
  applied,
  onMark,
  onWrongFit,
  highlight,
  selectedUrls,
  onToggleSelect,
}: {
  title: string;
  jobs: Job[];
  empty: string;
  applied: Record<string, AppliedRecord>;
  onMark: (url: string, st: JobStatus) => void;
  onWrongFit: (kind: "seniority" | "field", job: Job) => void;
  highlight?: boolean;
  selectedUrls?: Set<string>;
  onToggleSelect?: (url: string) => void;
}) {
  return (
    <section
      className={
        highlight
          ? "glass-panel-highlight p-4 sm:p-6"
          : "glass-panel-subtle p-4 sm:p-6"
      }
    >
      <h3 className="text-lg font-medium text-sand">{title}</h3>
      {!jobs.length ? (
        <p className="mt-4 text-sm text-sand-muted">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {jobs.map((job) => {
            const st = getJobStatus(job.url, applied);
            return (
              <li key={job.url} className="glass-card p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {onToggleSelect ? (
                        <label className="flex items-center gap-1.5 text-xs text-sand-muted">
                          <input
                            type="checkbox"
                            checked={selectedUrls?.has(job.url) ?? false}
                            onChange={() => onToggleSelect(job.url)}
                            className="size-4 rounded border-[var(--line)]"
                            aria-label={`Select ${job.title}`}
                          />
                          Select
                        </label>
                      ) : null}
                      {job.match?.band ? (
                        <span className="glass-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-seafoam">
                          Band {job.match.band}
                        </span>
                      ) : null}
                      <span className="glass-chip-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-sand-muted">
                        {st}
                      </span>
                    </div>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onMark(job.url, "ready")}
                      className="focus-ring mt-1 block break-words text-base font-medium text-copper hover:underline"
                    >
                      {job.title}
                    </a>
                    <p className="mt-1 break-words text-sm text-sand">
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
                            className="glass-chip px-2 py-0.5 text-[11px] text-seafoam"
                          >
                            {t}
                          </span>
                        ))}
                        {job.match.skills_matched.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="glass-chip-muted px-2 py-0.5 text-[11px] text-sand-muted"
                          >
                            {s}
                          </span>
                        ))}
                        {job.match.geo_matched ? (
                          <span className="glass-chip-muted px-2 py-0.5 text-[11px] text-sand-muted">
                            Location
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
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:max-w-[11rem] sm:shrink-0 sm:grid-cols-1">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onMark(job.url, "ready")}
                      className="focus-ring glass-btn-seafoam touch-target col-span-2 px-4 py-3 text-center text-sm font-medium sm:col-span-1 sm:py-2 sm:text-xs"
                    >
                      Open listing
                    </a>
                    <button
                      type="button"
                      onClick={() => onMark(job.url, "applied")}
                      className="focus-ring glass-btn-primary touch-target px-4 py-3 text-sm sm:py-2 sm:text-xs"
                    >
                      Mark applied
                    </button>
                    <button
                      type="button"
                      onClick={() => onMark(job.url, "skipped")}
                      className="focus-ring glass-btn-ghost touch-target px-4 py-3 text-sm sm:py-2 sm:text-xs"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => onMark(job.url, "saved")}
                      className="focus-ring glass-btn-ghost touch-target px-4 py-3 text-sm sm:py-2 sm:text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => onWrongFit("seniority", job)}
                      className="focus-ring glass-btn-ghost touch-target col-span-2 px-3 py-2.5 text-xs sm:col-span-1"
                    >
                      Wrong seniority
                    </button>
                    <button
                      type="button"
                      onClick={() => onWrongFit("field", job)}
                      className="focus-ring glass-btn-ghost touch-target col-span-2 px-3 py-2.5 text-xs sm:col-span-1"
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

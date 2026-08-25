"use client";

import { useState } from "react";
import {
  FILTER_SELECT_CLASS,
  WORK_MODE_OPTIONS,
} from "@/lib/filters";
import { DATE_WINDOWS } from "@/lib/preferences";
import type { DateWindowId, JobStatus, Preferences } from "@/lib/types";

type HuntFiltersProps = {
  prefs: Preferences;
  fitFilter: "eligible" | "all";
  onFitFilterChange: (v: "eligible" | "all") => void;
  dateFilter: DateWindowId;
  onDateWindowChange: (id: DateWindowId) => void;
  statusFilter: "all" | JobStatus;
  onStatusFilterChange: (v: "all" | JobStatus) => void;
  showBandC: boolean;
  onShowBandCChange: (v: boolean) => void;
  onWorkModeChange: (mode: Preferences["work_mode"]) => void;
  excludeInput: string;
  onExcludeInputChange: (v: string) => void;
  onExcludeCommit: () => void;
  onMustHaveSkillsChange: (skills: string[]) => void;
  splitKeywordListInput: (raw: string) => string[];
  onResetFilters: () => void;
};

export function HuntFilters({
  prefs,
  fitFilter,
  onFitFilterChange,
  dateFilter,
  onDateWindowChange,
  statusFilter,
  onStatusFilterChange,
  showBandC,
  onShowBandCChange,
  onWorkModeChange,
  excludeInput,
  onExcludeInputChange,
  onExcludeCommit,
  onMustHaveSkillsChange,
  splitKeywordListInput,
  onResetFilters,
}: HuntFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const filterFields = (
    <>
      <label className="block text-sm">
        <span className="text-sand-muted">Fit</span>
        <select
          value={fitFilter}
          onChange={(e) =>
            onFitFilterChange(e.target.value as "eligible" | "all")
          }
          className={`app-select ${FILTER_SELECT_CLASS}`}
        >
          <option value="eligible">Eligible only</option>
          <option value="all">All scraped</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-sand-muted">Posted within</span>
        <select
          value={dateFilter}
          onChange={(e) =>
            onDateWindowChange(e.target.value as DateWindowId)
          }
          className={`app-select ${FILTER_SELECT_CLASS}`}
        >
          {DATE_WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-sand-muted">Work mode</span>
        <select
          value={prefs.work_mode || "any"}
          onChange={(e) =>
            onWorkModeChange(e.target.value as Preferences["work_mode"])
          }
          className={`app-select ${FILTER_SELECT_CLASS}`}
        >
          {WORK_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-sand-muted">Apply status</span>
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as "all" | JobStatus)
          }
          className={`app-select ${FILTER_SELECT_CLASS}`}
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
      <label className="flex min-h-[44px] items-center gap-3 text-sm text-sand-muted sm:items-end sm:pb-2">
        <input
          type="checkbox"
          checked={showBandC}
          onChange={(e) => onShowBandCChange(e.target.checked)}
          className="size-4 shrink-0 rounded border-[var(--line)]"
        />
        Show band C
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-sand-muted">Exclude title keywords</span>
        <input
          value={excludeInput}
          onChange={(e) => onExcludeInputChange(e.target.value)}
          onBlur={onExcludeCommit}
          placeholder="senior, manager, sales…"
          className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="text-sand-muted">Must-have skills</span>
        <input
          value={prefs.must_have_skills.join(", ")}
          onChange={(e) =>
            onMustHaveSkillsChange(splitKeywordListInput(e.target.value))
          }
          className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
        />
      </label>
    </>
  );

  return (
    <div className="glass-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-sand">Refine results</h2>
          <p className="mt-1 text-xs text-sand-muted">
            Fit, date, work mode, and excludes — after you Hunt from the search
            bar above. Public portals only; we never scrape LinkedIn.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResetFilters}
            className="focus-ring glass-btn-ghost touch-target px-3 py-2 text-xs"
          >
            Reset filters
          </button>
          <button
            type="button"
            className="focus-ring glass-btn-ghost touch-target px-3 py-2 text-xs lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? "Hide filters" : "Show filters"}
          </button>
        </div>
      </div>

      <div className="mt-4 hidden lg:block">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filterFields}
        </div>
      </div>

      <div
        className={`mt-4 space-y-4 lg:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <div className="grid gap-3 sm:grid-cols-2">{filterFields}</div>
      </div>
    </div>
  );
}

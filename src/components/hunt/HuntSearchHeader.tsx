"use client";

import { FILTER_SELECT_CLASS } from "@/lib/filters";

type RegionOpt = { id: string; label: string };

type HuntSearchHeaderProps = {
  titlesInput: string;
  onTitlesInputChange: (v: string) => void;
  onTitlesCommit: () => void;
  regionId: string;
  regions: RegionOpt[];
  onRegionChange: (id: string) => void;
  locations: string[];
  busy: boolean;
  canHunt: boolean;
  onHunt: () => void;
  huntSource: "index" | "live_scrape" | null;
};

export function HuntSearchHeader({
  titlesInput,
  onTitlesInputChange,
  onTitlesCommit,
  regionId,
  regions,
  onRegionChange,
  locations,
  busy,
  canHunt,
  onHunt,
  huntSource,
}: HuntSearchHeaderProps) {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onTitlesCommit();
    onHunt();
  }

  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-light tracking-tight text-sand">
            Search jobs
          </h2>
          <p className="mt-1 text-xs text-sand-muted">
            Type titles like the big boards — Hunt runs without Analyze. Resume
            sharpening is optional.
          </p>
        </div>
        {huntSource ? (
          <span className="glass-badge inline-flex px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-seafoam">
            {huntSource === "index" ? "Shared index" : "Live scrape"}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={submit}
        className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <label className="block min-w-0 flex-1 text-sm">
          <span className="text-sand-muted">Job titles / keywords</span>
          <input
            value={titlesInput}
            onChange={(e) => onTitlesInputChange(e.target.value)}
            onBlur={onTitlesCommit}
            placeholder="Network Engineer, NOC Engineer, IT Support…"
            autoComplete="off"
            className="focus-ring glass-input mt-1 w-full px-3 py-3 text-sm placeholder:text-sand-muted/50"
            aria-label="Job titles or keywords"
          />
        </label>
        <label className="block w-full text-sm lg:w-52">
          <span className="text-sand-muted">Location / region</span>
          <select
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
            className={`app-select ${FILTER_SELECT_CLASS}`}
            aria-label="Region pack"
          >
            {regions.length === 0 ? (
              <option value={regionId}>{regionId}</option>
            ) : (
              regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="flex w-full sm:w-auto">
          <button
            type="submit"
            disabled={busy || !canHunt}
            className="focus-ring glass-btn-primary touch-target w-full px-6 py-3 text-sm disabled:opacity-60 sm:min-w-[9.5rem]"
          >
            {busy ? "Hunting…" : "Hunt"}
          </button>
        </div>
      </form>
      {locations.length > 0 ? (
        <p className="mt-2 text-[11px] text-sand-muted">
          Searching near{" "}
          <span className="text-sand">{locations.slice(0, 3).join(" · ")}</span>
          {locations.length > 3 ? "…" : ""}
        </p>
      ) : null}
    </section>
  );
}

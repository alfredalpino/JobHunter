"use client";

import { FILTER_SELECT_CLASS } from "@/lib/filters";
import type { Preferences, Profile } from "@/lib/types";

type RegionOpt = { id: string; label: string };

type ProfileRailProps = {
  profile: Profile;
  prefs: Preferences;
  regions: RegionOpt[];
  updateProfileField: (patch: Partial<Profile>) => void;
  onSeniorityBandChange: (band: string) => void;
  onRegionChange: (id: string) => void;
  syncPrefs: (next: Preferences) => void;
  splitListInput: (raw: string) => string[];
  splitKeywordListInput: (raw: string) => string[];
};

export function ProfileRail({
  profile,
  prefs,
  regions,
  updateProfileField,
  onSeniorityBandChange,
  onRegionChange,
  syncPrefs,
  splitListInput,
  splitKeywordListInput,
}: ProfileRailProps) {
  return (
    <section className="glass-panel p-4 sm:p-5">
      <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-light text-sand">
        Profile
      </h2>
      {profile.plain_summary ? (
        <p className="mt-2 line-clamp-3 text-xs text-sand-muted">
          {profile.plain_summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {profile.experience.estimated_years != null ? (
          <span className="glass-chip-muted px-2 py-1 text-sand-muted">
            ~{profile.experience.estimated_years} yrs
          </span>
        ) : null}
        <span className="glass-chip px-2 py-1 text-seafoam">
          {prefs.seniority_band || profile.experience.max_job_level || "mid"}
        </span>
        {Array.from(new Set(profile.certifications))
          .slice(0, 4)
          .map((c) => (
            <span key={c} className="glass-chip px-2 py-1 text-seafoam">
              {c}
            </span>
          ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-sand-muted">Name</span>
          <input
            value={profile.candidate.name}
            onChange={(e) =>
              updateProfileField({
                candidate: { ...profile.candidate, name: e.target.value },
              })
            }
            className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">
            Target titles{" "}
            <span className="font-normal">(synced with search bar)</span>
          </span>
          <textarea
            value={profile.target_titles.join("\n")}
            onChange={(e) =>
              updateProfileField({
                target_titles: splitListInput(e.target.value),
              })
            }
            rows={3}
            className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Must-have skills</span>
          <input
            value={profile.skills_positive.join(", ")}
            onChange={(e) =>
              updateProfileField({
                skills_positive: splitListInput(e.target.value),
              })
            }
            className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-sand-muted">Max years req.</span>
            <input
              type="number"
              min={1}
              max={15}
              value={profile.experience.max_years_required}
              onChange={(e) =>
                updateProfileField({
                  experience: {
                    ...profile.experience,
                    max_years_required: Number(e.target.value) || 2,
                  },
                })
              }
              className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-sand-muted">Seniority</span>
            <select
              value={prefs.seniority_band}
              onChange={(e) => onSeniorityBandChange(e.target.value)}
              className={`app-select ${FILTER_SELECT_CLASS}`}
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
        </div>
        <label className="block text-sm">
          <span className="text-sand-muted">Region pack</span>
          <select
            value={prefs.region}
            onChange={(e) => onRegionChange(e.target.value)}
            className={`app-select ${FILTER_SELECT_CLASS}`}
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
                locations: splitKeywordListInput(e.target.value),
              })
            }
            className="focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Work authorization</span>
          <select
            value={prefs.work_auth || ""}
            onChange={(e) =>
              syncPrefs({ ...prefs, work_auth: e.target.value })
            }
            className={`app-select ${FILTER_SELECT_CLASS}`}
          >
            <option value="">Not specified</option>
            <option value="authorized">Authorized to work</option>
            <option value="needs_sponsorship">Needs visa sponsorship</option>
            <option value="has_work_visa">Has valid work visa</option>
            <option value="uae_national">UAE / GCC national</option>
            <option value="us_citizen">US citizen / green card</option>
          </select>
        </label>
      </div>

      {profile.search_queries.length > 0 ? (
        <p className="mt-3 break-words text-[11px] text-sand-muted">
          Hunt queries:{" "}
          <span className="text-sand">{profile.search_queries.join(" · ")}</span>
        </p>
      ) : null}
    </section>
  );
}

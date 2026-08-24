"use client";

import { useEffect, useState } from "react";

type Region = {
  id: string;
  label: string;
};

export function RegionPicker() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selected, setSelected] = useState("dubai");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data) => setRegions(data.regions ?? []))
      .catch(() => setError("Could not load regions stub."));
  }, []);

  return (
    <section
      id="region"
      className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6"
    >
      <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
        Prefer region
      </h2>
      <p className="mt-2 text-sm text-sand-muted">
        Same packs as{" "}
        <code className="text-sand">config/regions/</code>. In the CLI, set{" "}
        <code className="text-sand">region:</code> in preferences.yaml or pass{" "}
        <code className="text-sand">--region</code>.
      </p>
      <label className="mt-6 block text-sm">
        <span className="text-sand-muted">Region pack</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand"
        >
          {regions.length === 0 && !error ? (
            <option value="dubai">Loading…</option>
          ) : (
            regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))
          )}
        </select>
      </label>
      {error ? <p className="mt-3 text-sm text-copper">{error}</p> : null}
      <p className="mt-4 text-sm text-sand-muted">
        Selected: <span className="text-sand">{selected}</span> — save this as{" "}
        <code className="text-sand">region: {selected}</code> in your preferences
        file.
      </p>
    </section>
  );
}

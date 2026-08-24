"use client";

import { useState } from "react";

export function AnalyzePanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          note: "Web stub — wire to JobHunter CLI/profile builder later.",
        }),
      });
      const data = await res.json();
      setStatus(data.message ?? "Stub response received.");
    } catch {
      setStatus("Could not reach the stub API. Is the Next.js server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="analyze"
      className="rounded-2xl border border-[var(--line)] bg-ink-mid/50 p-6"
    >
      <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-light text-sand">
        Analyze resume
      </h2>
      <p className="mt-2 text-sm text-sand-muted">
        Upload stays local in the Python UI for now. This form calls a stub so
        the product site can grow into a real API.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-sand-muted">Display name</span>
          <input
            name="name"
            required
            placeholder="Your name"
            className="focus-ring mt-1 w-full rounded-xl border border-[var(--line)] bg-ink px-3 py-2.5 text-sand placeholder:text-sand-muted/50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Resume file (preview only)</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="focus-ring mt-1 block w-full text-sm text-sand-muted file:mr-3 file:rounded-full file:border-0 file:bg-seafoam/20 file:px-3 file:py-1.5 file:text-seafoam"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="focus-ring rounded-full bg-copper px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "Checking stub…" : "Analyze resume"}
        </button>
      </form>
      {status ? (
        <p className="mt-4 text-sm leading-relaxed text-seafoam" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}

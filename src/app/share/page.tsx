"use client";

import { useEffect, useState } from "react";
import {
  decodeSharePayload,
  downloadJobs,
  type ExportContext,
  type SharePayload,
} from "@/lib/export";

export default function SharePage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#j=/, "").replace(/^#/, "");
    if (!hash) {
      setError("No shared job list in this link.");
      return;
    }
    const data = decodeSharePayload(hash);
    if (!data) {
      setError("Invalid or expired share link.");
      return;
    }
    setPayload(data);
  }, []);

  function handleDownloadCsv() {
    if (!payload) return;
    const ctx: ExportContext = {
      applied: {},
      candidateName: payload.manifest.candidateName,
      scope: payload.manifest.scope,
      filterSummary: payload.manifest.filterSummary,
    };
    downloadJobs(payload.jobs, "csv", ctx);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-sand">
          Shared job list
        </h1>
        <p className="mt-4 text-sand-muted">{error}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sand-muted">Loading shared jobs…</p>
      </main>
    );
  }

  const { manifest, jobs } = payload;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <header>
        <p className="text-xs uppercase tracking-wider text-seafoam">
          Shared snapshot · read only
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-light text-sand">
          {manifest.candidateName
            ? `Jobs for ${manifest.candidateName}`
            : "Shared job listings"}
        </h1>
        <p className="mt-2 text-sm text-sand-muted">
          Generated {new Date(manifest.generatedAt).toLocaleString()} ·{" "}
          {jobs.length} jobs
        </p>
        <p className="mt-1 text-xs text-sand-muted">
          Listings may have expired — always apply on the original posting site.
          JobHunter does not auto-apply.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="focus-ring glass-btn-primary px-4 py-2 text-sm"
        >
          Download CSV
        </button>
        <a
          href="/"
          className="focus-ring glass-btn-ghost px-4 py-2 text-sm"
        >
          Run your own hunt
        </a>
      </div>

      <ul className="space-y-4">
        {jobs.map((job) => (
          <li key={job.url} className="glass-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              {job.match?.band ? (
                <span className="glass-chip px-2 py-0.5 text-[10px] font-semibold uppercase text-seafoam">
                  Band {job.match.band}
                </span>
              ) : null}
              {job.score != null ? (
                <span className="text-xs text-sand-muted">Score {job.score}</span>
              ) : null}
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mt-1 block text-base font-medium text-copper hover:underline"
            >
              {job.title}
            </a>
            <p className="mt-1 text-sm text-sand">
              {job.company}
              {job.location ? ` · ${job.location}` : ""}
            </p>
            {job.summary ? (
              <p className="mt-2 line-clamp-2 text-sm text-sand-muted">
                {job.summary}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

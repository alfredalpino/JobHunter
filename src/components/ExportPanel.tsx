"use client";

import { useMemo, useState } from "react";
import {
  buildShareUrl,
  canNativeShare,
  chunkForWhatsApp,
  copyToClipboard,
  downloadJobs,
  encodeSharePayload,
  formatJobs,
  mailtoUrl,
  nativeShare,
  previewExportSize,
  whatsAppUrl,
  type ExportFormat,
  type ExportScope,
} from "@/lib/export";
import { getJobStatus } from "@/lib/applied";
import type { AppliedRecord, Job } from "@/lib/types";

const SCOPE_LABELS: Record<ExportScope, string> = {
  visible: "Visible (current filters)",
  selected: "Selected jobs",
  saved: "Saved only",
  queue: "Today's queue (top 10)",
  all_eligible: "All eligible scraped",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown (.md)",
  csv: "CSV (.csv)",
  json: "JSON (.json)",
  text: "Plain text",
};

type ExportPanelProps = {
  visibleJobs: Job[];
  allJobs: Job[];
  queueJobs: Job[];
  selectedUrls: Set<string>;
  applied: Record<string, AppliedRecord>;
  candidateName?: string;
  filterSummary?: string;
  onStatus?: (msg: string) => void;
};

function resolveScopeJobs(
  scope: ExportScope,
  props: ExportPanelProps,
): Job[] {
  switch (scope) {
    case "visible":
      return props.visibleJobs;
    case "selected":
      return props.visibleJobs.filter((j) => props.selectedUrls.has(j.url));
    case "saved":
      return props.visibleJobs.filter(
        (j) => getJobStatus(j.url, props.applied) === "saved",
      );
    case "queue":
      return props.queueJobs;
    case "all_eligible":
      return props.allJobs.filter((j) => j.eligible);
    default:
      return props.visibleJobs;
  }
}

export function ExportPanel(props: ExportPanelProps) {
  const [scope, setScope] = useState<ExportScope>("visible");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [waChunks, setWaChunks] = useState<string[] | null>(null);

  const exportJobs = useMemo(() => resolveScopeJobs(scope, props), [scope, props]);

  const ctx = useMemo(
    () => ({
      applied: props.applied,
      candidateName: props.candidateName,
      scope,
      filterSummary: props.filterSummary,
    }),
    [props.applied, props.candidateName, props.filterSummary, scope],
  );

  const sizePreview = useMemo(
    () => previewExportSize(exportJobs, format, ctx),
    [exportJobs, format, ctx],
  );

  function notify(msg: string) {
    props.onStatus?.(msg);
  }

  async function handleCopy() {
    if (!exportJobs.length) {
      notify("Nothing to copy for this scope.");
      return;
    }
    const text = formatJobs(exportJobs, format === "csv" ? "text" : format, ctx);
    const ok = await copyToClipboard(text);
    notify(ok ? `Copied ${exportJobs.length} jobs to clipboard.` : "Copy failed — try download.");
  }

  function handleDownload() {
    if (!exportJobs.length) {
      notify("Nothing to export for this scope.");
      return;
    }
    downloadJobs(exportJobs, format, ctx);
    notify(`Downloaded ${exportJobs.length} jobs as ${format}.`);
  }

  function handleWhatsAppPrepare() {
    if (!exportJobs.length) {
      notify("Nothing to share for this scope.");
      return;
    }
    const text = formatJobs(exportJobs, "text", ctx);
    setWaChunks(chunkForWhatsApp(text));
  }

  function handleWhatsAppOpen(chunk: string, part: number, total: number) {
    window.open(whatsAppUrl(`(${part}/${total})\n${chunk}`), "_blank", "noopener,noreferrer");
  }

  async function handleNativeShare() {
    if (!exportJobs.length) return;
    const text = formatJobs(exportJobs, "text", ctx).slice(0, 4000);
    const ok = await nativeShare(
      `Job listings (${exportJobs.length})`,
      text,
    );
    notify(ok ? "Shared via device." : "Share cancelled or unavailable.");
  }

  async function handleShareLink() {
    if (!exportJobs.length) {
      notify("Nothing to share.");
      return;
    }
    const { hash, error } = encodeSharePayload(exportJobs, ctx);
    if (error || !hash) {
      notify(error || "Could not build share link.");
      return;
    }
    const url = buildShareUrl(hash);
    const ok = await copyToClipboard(url);
    notify(ok ? "Share link copied (valid for ≤20 jobs)." : url);
  }

  function handleEmail() {
    if (!exportJobs.length) return;
    const body = formatJobs(exportJobs, "text", ctx).slice(0, 1500);
    const subject = `Job listings — ${props.candidateName || "candidate"}`;
    window.location.href = mailtoUrl(subject, body);
  }

  return (
    <section className="glass-panel-subtle mt-6 p-4 sm:p-6">
      <h3 className="text-lg font-medium text-sand">Export &amp; share</h3>
      <p className="mt-1 text-xs text-sand-muted">
        Client-side only — nothing is stored on our servers. Apply on original
        posting sites.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-sand-muted">Scope</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as ExportScope);
              setWaChunks(null);
            }}
            className="app-select focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          >
            {(Object.keys(SCOPE_LABELS) as ExportScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-sand-muted">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="app-select focus-ring glass-input mt-1 w-full px-3 py-2 text-sm"
          >
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-sand-muted">
        {exportJobs.length} jobs · ~{sizePreview.label} {format.toUpperCase()}
        {scope === "selected" && props.selectedUrls.size === 0
          ? " — select jobs below"
          : ""}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!exportJobs.length}
          className="focus-ring glass-btn-primary touch-target px-4 py-2.5 text-sm disabled:opacity-50"
        >
          Download
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!exportJobs.length}
          className="focus-ring glass-btn-seafoam touch-target px-4 py-2.5 text-sm disabled:opacity-50"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={handleWhatsAppPrepare}
          disabled={!exportJobs.length}
          className="focus-ring glass-btn-ghost touch-target px-4 py-2.5 text-sm disabled:opacity-50"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={handleEmail}
          disabled={!exportJobs.length}
          className="focus-ring glass-btn-ghost touch-target px-4 py-2.5 text-sm disabled:opacity-50"
        >
          Email
        </button>
        {canNativeShare() ? (
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!exportJobs.length}
            className="focus-ring glass-btn-ghost touch-target px-4 py-2.5 text-sm disabled:opacity-50"
          >
            Share
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleShareLink}
          disabled={!exportJobs.length || exportJobs.length > 20}
          title={exportJobs.length > 20 ? "Max 20 jobs for share link" : undefined}
          className="focus-ring glass-btn-ghost touch-target px-4 py-2.5 text-sm disabled:opacity-50"
        >
          Copy share link
        </button>
      </div>

      {waChunks && waChunks.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-lg border border-[var(--line)] p-3">
          <p className="text-xs text-sand-muted">
            WhatsApp limits message length — send in {waChunks.length} part
            {waChunks.length > 1 ? "s" : ""}. Copy works best on desktop.
          </p>
          {waChunks.map((chunk, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleWhatsAppOpen(chunk, i + 1, waChunks.length)
                }
                className="focus-ring glass-btn-seafoam px-3 py-1.5 text-xs"
              >
                Open part {i + 1}/{waChunks.length}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyToClipboard(chunk);
                  notify(ok ? `Part ${i + 1} copied.` : "Copy failed.");
                }}
                className="focus-ring glass-btn-ghost px-3 py-1.5 text-xs"
              >
                Copy part {i + 1}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

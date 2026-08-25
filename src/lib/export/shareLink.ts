import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Job } from "../types";
import type { ExportContext, SharePayload } from "./types";
import { SHARE_LINK_MAX_JOBS } from "./types";
import { buildManifest } from "./json";

export function encodeSharePayload(
  jobs: Job[],
  ctx: ExportContext,
): { hash: string; error?: string } {
  if (jobs.length > SHARE_LINK_MAX_JOBS) {
    return {
      hash: "",
      error: `Share links support up to ${SHARE_LINK_MAX_JOBS} jobs. You have ${jobs.length} — use download instead.`,
    };
  }

  const payload: SharePayload = {
    v: 1,
    manifest: buildManifest(jobs, ctx),
    jobs: jobs.map((j) => ({
      title: j.title,
      company: j.company,
      url: j.url,
      portal: j.portal,
      location: j.location,
      summary: (j.summary || "").slice(0, 200),
      posted_at: j.posted_at,
      posted_age_days: j.posted_age_days,
      score: j.score,
      eligible: j.eligible,
      match: j.match,
    })),
  };

  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  if (!compressed) {
    return { hash: "", error: "Could not compress share data." };
  }
  if (compressed.length > 8000) {
    return {
      hash: "",
      error: "Share link too large — reduce job count or use download.",
    };
  }
  return { hash: compressed };
}

export function decodeSharePayload(hash: string): SharePayload | null {
  if (!hash) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const data = JSON.parse(json) as SharePayload;
    if (data.v !== 1 || !Array.isArray(data.jobs) || !data.manifest) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildShareUrl(hash: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share#j=${hash}`;
}

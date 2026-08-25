import type { AppliedRecord, Job, JobStatus } from "../types";

export type ExportFormat = "markdown" | "csv" | "json" | "text";

export type ExportScope =
  | "visible"
  | "selected"
  | "saved"
  | "queue"
  | "all_eligible";

export type ExportManifest = {
  v: 1;
  generatedAt: string;
  candidateName: string;
  scope: ExportScope;
  format?: ExportFormat;
  filterSummary?: string;
  jobCount: number;
};

export type ExportRow = {
  band: string;
  score: number;
  title: string;
  company: string;
  location: string;
  portal: string;
  posted_at: string;
  posted_age_days: number | null;
  recency_bucket: string;
  status: JobStatus;
  url: string;
  query: string;
  summary: string;
  title_matched: string;
  skills_matched: string;
  eligible: boolean;
  reject_reason: string;
  ai_note: string;
};

export type SharePayload = {
  v: 1;
  manifest: ExportManifest;
  jobs: Job[];
};

export type ExportContext = {
  applied: Record<string, AppliedRecord>;
  candidateName?: string;
  scope: ExportScope;
  filterSummary?: string;
};

export const SHARE_LINK_MAX_JOBS = 20;
export const WHATSAPP_CHUNK_CHARS = 1500;

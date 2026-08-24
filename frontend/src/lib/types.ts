export type RecencyBucket =
  | "last_7_days"
  | "days_8_to_14"
  | "days_15_to_21"
  | "days_22_to_30"
  | "older"
  | "unknown"
  | "stale";

export type DateWindowId =
  | "this_week"
  | "last_week"
  | "weeks_2_to_3"
  | "weeks_3_to_4"
  | "one_month"
  | "all_fresh"
  | "any_age";

export type ScoreBand = "A" | "B" | "C";

export type MatchReason = {
  title_matched: string[];
  skills_matched: string[];
  geo_matched: boolean;
  seniority_ok: boolean;
  score: number;
  band: ScoreBand;
};

export type JobStatus =
  | "new"
  | "saved"
  | "ready"
  | "applied"
  | "skipped"
  | "ghosted";

export type Job = {
  title: string;
  company: string;
  url: string;
  portal: string;
  location: string;
  summary: string;
  posted_at: string;
  query?: string;
  source_method?: string;
  eligible?: boolean;
  score?: number;
  reject_reason?: string;
  posted_age_days?: number | null;
  recency_bucket?: RecencyBucket;
  match?: MatchReason;
  ai_note?: string;
  ai_bullets?: string[];
};

export type Preferences = {
  region: string;
  locations: string[];
  target_titles: string[];
  must_have_skills: string[];
  exclude_titles: string[];
  seniority_band: string;
  work_auth: string;
  work_mode: "any" | "remote" | "onsite" | "hybrid";
  country_indeed: string;
  recency_max_days: number;
  /** UI date window label for filters */
  date_window?: DateWindowId;
};

export type Profile = {
  source: string;
  candidate: {
    name: string;
    email: string;
    phone: string;
    linkedin: string;
    location: string;
    work_auth?: string;
  };
  experience: {
    estimated_years: number | null;
    max_years_required: number;
    level: string;
    target_band: string;
    credibility: boolean;
    seniority_band?: string;
    max_job_level?: string;
  };
  target_titles: string[];
  search_queries: string[];
  skills_positive: string[];
  certifications: string[];
  title_must_match_any: string[];
  exclude_title_signals?: string[];
  raw_excerpt: string;
  plain_summary?: string;
  geo?: {
    region?: string | null;
    default_locations?: string[];
    allow_signals?: string[];
    reject_signals?: string[];
    country_indeed?: string;
    work_mode?: string;
  };
  scoring?: {
    min_score_to_keep?: number;
    title_weight?: number;
    skills_weight?: number;
    junior_boost?: number;
    mid_boost?: number;
    geo_boost?: number;
  };
  recency?: {
    max_age_days?: number;
    reject_unknown_date?: boolean;
    bucket_week_1_days?: number;
  };
};

export type RegionPack = {
  id: string;
  label: string;
  locations: string[];
  country_indeed: string;
  allow_signals: string[];
  reject_signals: string[];
};

export type HuntSourceResult = {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
};

export type AppliedRecord = {
  status: JobStatus;
  updatedAt: string;
};

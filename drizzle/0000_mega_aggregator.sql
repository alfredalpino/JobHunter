CREATE TABLE IF NOT EXISTS "sources" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "last_ok_at" timestamp with time zone,
  "last_error" text,
  "status" text DEFAULT 'unknown' NOT NULL
);

CREATE TABLE IF NOT EXISTS "clusters" (
  "id" text PRIMARY KEY NOT NULL,
  "canonical_title" text NOT NULL,
  "canonical_company" text NOT NULL,
  "member_count" integer DEFAULT 1 NOT NULL,
  "content_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "fingerprint" text NOT NULL,
  "title" text NOT NULL,
  "company" text NOT NULL,
  "url" text NOT NULL,
  "portal" text NOT NULL,
  "location" text DEFAULT '' NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "posted_at" text DEFAULT '' NOT NULL,
  "work_mode" text,
  "raw" jsonb,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "link_status" text DEFAULT 'unknown' NOT NULL,
  "cluster_id" text,
  "source_id" text
);

CREATE TABLE IF NOT EXISTS "ingest_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "fetched" integer DEFAULT 0 NOT NULL,
  "upserted" integer DEFAULT 0 NOT NULL,
  "errors" jsonb DEFAULT '[]'::jsonb
);

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cluster_id_clusters_id_fk"
    FOREIGN KEY ("cluster_id") REFERENCES "public"."clusters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_sources_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "jobs_fingerprint_uidx" ON "jobs" USING btree ("fingerprint");
CREATE INDEX IF NOT EXISTS "jobs_active_last_seen_idx" ON "jobs" USING btree ("is_active","last_seen_at");
CREATE INDEX IF NOT EXISTS "jobs_cluster_idx" ON "jobs" USING btree ("cluster_id");
CREATE INDEX IF NOT EXISTS "jobs_portal_idx" ON "jobs" USING btree ("portal");
CREATE INDEX IF NOT EXISTS "clusters_company_title_idx" ON "clusters" USING btree ("canonical_company","canonical_title");

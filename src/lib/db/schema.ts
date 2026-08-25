import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Portal / adapter health for the shared index. */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  lastError: text("last_error"),
  status: text("status").notNull().default("unknown"),
});

/** Cross-portal opening clusters (canonical title/company). */
export const clusters = pgTable(
  "clusters",
  {
    id: text("id").primaryKey(),
    canonicalTitle: text("canonical_title").notNull(),
    canonicalCompany: text("canonical_company").notNull(),
    memberCount: integer("member_count").notNull().default(1),
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("clusters_company_title_idx").on(
      t.canonicalCompany,
      t.canonicalTitle,
    ),
  ],
);

/** Shared job index — one row per fingerprint (portal listing). */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    url: text("url").notNull(),
    portal: text("portal").notNull(),
    location: text("location").notNull().default(""),
    summary: text("summary").notNull().default(""),
    postedAt: text("posted_at").notNull().default(""),
    workMode: text("work_mode"),
    raw: jsonb("raw"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    linkStatus: text("link_status").notNull().default("unknown"),
    clusterId: text("cluster_id").references(() => clusters.id, {
      onDelete: "set null",
    }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("jobs_fingerprint_uidx").on(t.fingerprint),
    index("jobs_active_last_seen_idx").on(t.isActive, t.lastSeenAt),
    index("jobs_cluster_idx").on(t.clusterId),
    index("jobs_portal_idx").on(t.portal),
  ],
);

/** Cron / admin ingest run telemetry. */
export const ingestRuns = pgTable("ingest_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  fetched: integer("fetched").notNull().default(0),
  upserted: integer("upserted").notNull().default(0),
  errors: jsonb("errors").$type<unknown[]>().default([]),
});

export type SourceRow = typeof sources.$inferSelect;
export type ClusterRow = typeof clusters.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type IngestRunRow = typeof ingestRuns.$inferSelect;

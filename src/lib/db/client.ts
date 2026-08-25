import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

let cached: AppDb | null | undefined;
let sqlClient: ReturnType<typeof postgres> | null = null;

/**
 * Returns a Drizzle client when DATABASE_URL is set, otherwise null.
 * Local `npm run dev` works without Postgres (live scrape fallback).
 */
export function getDb(): AppDb | null {
  if (cached !== undefined) return cached;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    cached = null;
    return null;
  }

  try {
    sqlClient = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    cached = drizzle(sqlClient, { schema });
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** Test helper — clear singleton between cases. */
export function resetDbCache(): void {
  cached = undefined;
  if (sqlClient) {
    void sqlClient.end({ timeout: 1 }).catch(() => undefined);
    sqlClient = null;
  }
}

/**
 * Anonymous in-memory scrape cache (per warm serverless instance).
 * Not user storage — shared TTL cache for identical source+query keys.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_SECONDS = Number(
  process.env.SCRAPE_CACHE_TTL_SECONDS || "900",
);

export function scrapeCacheTtlMs(): number {
  return DEFAULT_TTL_SECONDS * 1000;
}

export function scrapeCacheKey(
  sourceId: string,
  query: string,
  region = "",
): string {
  const q = query.toLowerCase().trim().slice(0, 80);
  const r = region.toLowerCase().trim();
  return `${sourceId}|${r}|${q}`;
}

export function getScrapeCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setScrapeCache<T>(
  key: string,
  value: T,
  ttlMs = scrapeCacheTtlMs(),
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt < now) store.delete(k);
    }
  }
}

export async function withScrapeCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = scrapeCacheTtlMs(),
): Promise<T> {
  const hit = getScrapeCache<T>(key);
  if (hit != null) return hit;
  const value = await fn();
  setScrapeCache(key, value, ttlMs);
  return value;
}

/** For tests */
export function clearScrapeCache(): void {
  store.clear();
}

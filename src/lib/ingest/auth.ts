/**
 * Authorize cron / admin ingest routes.
 * Accepts Authorization: Bearer <CRON_SECRET> or ?secret= / x-cron-secret.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get("x-cron-secret")?.trim();
  if (header && header === secret) return true;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("secret");
    if (q && q === secret) return true;
  } catch {
    /* ignore */
  }
  return false;
}

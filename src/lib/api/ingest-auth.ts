import type { NextRequest } from "next/server";

/**
 * Shared auth for the ingest endpoints.
 *
 * - CRON_SECRET set: require `Authorization: Bearer <secret>` or `?secret=<secret>`.
 * - CRON_SECRET unset: allow only in development; refuse everywhere else so a
 *   deploy that forgot the secret doesn't expose a costly public endpoint.
 */
export function authorizeIngest(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV === "development"
      ? { ok: true }
      : { ok: false, reason: "CRON_SECRET is not configured on the server" };
  }

  const header = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (header === `Bearer ${secret}` || querySecret === secret) return { ok: true };

  return {
    ok: false,
    reason: header || querySecret ? "Secret does not match CRON_SECRET" : "Missing secret",
  };
}

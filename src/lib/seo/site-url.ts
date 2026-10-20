/**
 * Absolute site origin (no trailing slash) for metadata, sitemap and OpenGraph.
 * NEXT_PUBLIC_SITE_URL wins; on Vercel without it, fall back to the project's
 * production domain, then the deployment URL, so links never point at localhost.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}

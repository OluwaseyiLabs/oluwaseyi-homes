/**
 * The website's own public address, from configuration only: SITE_URL when set, otherwise the production address
 * Vercel provides (the custom domain once there is one). Used for robots.txt, the sitemap, link previews and as
 * the base for emailed links. On a developer's machine it falls back to localhost.
 */
export function publicOrigin(): string | null {
  const fixed = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (fixed && /^https?:\/\/[^\s/]+$/.test(fixed)) return fixed;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  return null;
}

/** For pages: never null, so metadata always has a base. */
export const siteOrigin = () => publicOrigin() ?? "http://localhost:3000";

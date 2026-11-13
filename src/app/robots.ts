import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    // The dashboard, the private links in emails and the enquiry tracker are not for search engines.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/r/", "/track", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    // The dashboard, the private links in emails and the enquiry tracker are not for search engines.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/r/", "/track", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

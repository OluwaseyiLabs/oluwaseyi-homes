import type { MetadataRoute } from "next";
import { getPublishedListings } from "@/lib/data";
import { LEGAL_SLUGS } from "@/lib/legal";
import { propertyPath } from "@/lib/slug";

export const revalidate = 3600;
const base = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** The home page and one entry for every published property, so search engines find them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await getPublishedListings();
  return [
    { url: `${base()}/`, changeFrequency: "daily", priority: 1 },
    ...LEGAL_SLUGS.map((s) => ({ url: `${base()}/legal/${s}`, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...listings.map((l) => ({ url: `${base()}${propertyPath(l)}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}

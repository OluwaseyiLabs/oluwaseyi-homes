import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/data";

/** Lets Android (Chrome and Samsung Internet) add the site to the home screen with its name, colour and icon. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { site } = await getSiteContent();
  return {
    name: site.name,
    short_name: site.name.length > 14 ? site.name.split(" ")[0] : site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#14532d",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

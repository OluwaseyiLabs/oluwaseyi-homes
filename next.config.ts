import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Next.js dev button sits bottom right, so it does not cover the theme switch at the bottom left.
  devIndicators: { position: "bottom-right" },
  // The dashboard accepts a proof file (photo or PDF, up to 4 MB) with the form that records an owner's agreement.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Pages that are not for the public are kept out of search results by a header as well as by a tag in the page.
  async headers() {
    const privateHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      ...["/admin/:path*", "/r/:path*", "/track/:path*", "/track", "/api/:path*"].map((source) => ({ source, headers: privateHeaders })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  // Browsers and crawlers ask for /favicon.ico by habit.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon/32", permanent: false }];
  },
  images: {
    // Property photos uploaded from the dashboard are served from Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // One-hour links to private photos that owners sent in.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/**" },
    ],
  },
};

export default nextConfig;

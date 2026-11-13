import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";
// The storage and API host of this project's Supabase. Photos and uploads may only come from it.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

/**
 * What the browser is allowed to load and connect to. Scripts may only come from this site and Paystack (the
 * payment window). The inline allowance is needed by Next.js itself; everything else is locked to this site.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.paystack.co",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost}` : ""} https://api.paystack.co https://*.paystack.co https://*.paystack.com`,
  "frame-src https://checkout.paystack.com https://*.paystack.co https://*.paystack.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // The Next.js dev button sits bottom right, so it does not cover the theme switch at the bottom left.
  devIndicators: { position: "bottom-right" },
  // Do not announce the framework in every response.
  poweredByHeader: false,
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Only on the real site: the dev server needs looser rules (hot reload).
          ...(prod
            ? [
                { key: "Content-Security-Policy", value: csp },
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
              ]
            : []),
        ],
      },
    ];
  },
  // Browsers and crawlers ask for /favicon.ico by habit.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon/32", permanent: false }];
  },
  images: {
    // Property photos uploaded from the dashboard are served from this project's Supabase Storage only.
    remotePatterns: supabaseHost
      ? [
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
          // One-hour links to private photos that owners sent in.
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" },
        ]
      : [],
  },
};

export default nextConfig;

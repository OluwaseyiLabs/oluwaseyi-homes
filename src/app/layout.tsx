import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getSiteContent } from "@/lib/data";
import { photoUrl } from "@/lib/listings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tracker } from "@/components/Tracker";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();
  const title = `${site.name} | Your next property, made easier`;
  return {
    // Links in previews are made complete from this address. Set SITE_URL to the live website address.
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    title,
    description: site.description,
    openGraph: { title, description: site.description, siteName: site.name, type: "website", images: [{ url: photoUrl(site.heroImage) }] },
    twitter: { card: "summary_large_image", title, description: site.description, images: [photoUrl(site.heroImage)] },
  };
}

// The site has its own light and dark designs. Declaring both stops Samsung Internet and Chrome on Android from
// forcing their own dark mode over it.
export const viewport: Viewport = { themeColor: "#14532d", colorScheme: "light dark" };

/** Runs before the page paints, so a dark-mode visitor never sees a flash of the light page. */
const themeScript = `(function(){var d=document.documentElement;try{var s=localStorage.getItem("theme");var dark=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);d.dataset.theme=dark?"dark":"light"}catch(e){d.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ThemeToggle floating />
        <Tracker />
      </body>
    </html>
  );
}

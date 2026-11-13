import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { TrackLookup } from "@/components/TrackLookup";
import { getSiteContent } from "@/lib/data";

export const metadata: Metadata = { title: "Track your enquiry", robots: { index: false, follow: false } };

export default async function TrackPage() {
  const { site } = await getSiteContent();
  return (
    <main className="grid min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-xl">
        <Logo name={site.name} href="/" />
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight">Track your enquiry</h1>
          <p className="mt-2 text-muted">Enter the reference we gave you and the email you used.</p>
          <div className="mt-6">
            <TrackLookup />
          </div>
        </div>
      </div>
    </main>
  );
}

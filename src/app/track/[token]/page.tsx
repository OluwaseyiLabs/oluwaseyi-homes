import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TrackView } from "@/components/TrackView";
import { getSiteContent } from "@/lib/data";
import type { EnquiryProgress } from "@/lib/track";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Track your enquiry", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The page behind the "Track your enquiry" link in a customer's emails. The long private link is the key. */
export default async function Track({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ site }, found] = await Promise.all([
    getSiteContent(),
    /^[0-9a-f]{64}$/.test(token) ? supabaseAdmin().rpc("track_lead", { p_token: token }) : Promise.resolve({ data: null }),
  ]);
  const progress = (found.data ?? null) as EnquiryProgress | null;
  return (
    <main className="grid min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-xl">
        <Logo name={site.name} href="/" />
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-10">
          {progress ? (
            <TrackView progress={progress} />
          ) : (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight">This link is not valid.</h1>
              <p className="mt-3 text-lg text-muted">
                It may be incomplete or too old. You can look up your enquiry with its reference and email on the{" "}
                <Link href="/track" className="font-semibold text-green underline underline-offset-4">tracking page</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

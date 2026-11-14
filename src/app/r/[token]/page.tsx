import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { NewLinkButton } from "@/components/NewLinkButton";
import { PartyForm } from "@/components/PartyForm";
import { getSiteContent } from "@/lib/data";
import { readPartyToken } from "@/lib/party";

export const metadata: Metadata = { title: "Oluwaseyi Homes & Properties", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const problems = {
  invalid: ["This link is not valid.", "Check that you opened the whole link from the email."],
  expired: ["This link has expired.", "For your security, links only work for a short time. We can email you a new one."],
  used: ["This link has already been used.", "Thank you. Your answer is recorded, and there is nothing more to do."],
};

/** Where an owner or customer lands from a link in an email: to acknowledge an introduction or answer a follow-up. */
export default async function PartyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [visit, { site }] = await Promise.all([readPartyToken(token), getSiteContent()]);
  return (
    <main className="grid grid-cols-1 min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-xl">
        <Logo name={site.name} />
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-10">
          {typeof visit === "string" ? (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight">{problems[visit][0]}</h1>
              <p className="mt-3 text-lg text-muted">{problems[visit][1]}</p>
              {visit === "expired" && <NewLinkButton token={token} />}
            </>
          ) : (
            <PartyForm
              token={token}
              purpose={visit.purpose}
              party={visit.party}
              kind={visit.lead.kind}
              leadCode={visit.lead.code}
              property={visit.lead.property}
              customerName={visit.lead.customerName}
              canReport={!visit.lead.verified}
            />
          )}
        </div>
      </div>
    </main>
  );
}

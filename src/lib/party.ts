import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { publicOrigin } from "./origin";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Where emailed links should point. In production this comes only from configuration (SITE_URL, or the production
 * domain Vercel provides), never from the request, so a forged Host or Origin header cannot put another site's
 * address into an email. Request headers are used only on a developer's own machine.
 */
export async function siteUrl() {
  const configured = publicOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("SITE_URL is not set, so emailed links cannot be built safely.");
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a private link token for a customer or owner. Only its hash is stored. */
export async function partyToken(leadId: string, party: "customer" | "owner", purpose: string, days: number) {
  const { data, error } = await supabaseAdmin().rpc("make_party_token", { p_lead: leadId, p_party: party, p_purpose: purpose, p_days: days });
  return error || !data ? null : (data as string);
}

/** A private link for a customer or owner, as a full web address to put in an email. */
export async function partyLink(leadId: string, party: "customer" | "owner", purpose: string, days: number) {
  const token = await partyToken(leadId, party, purpose, days);
  return token ? `${await siteUrl()}/${purpose === "track" ? "track" : "r"}/${token}` : null;
}

export interface PartyVisit {
  tokenHash: string;
  party: "customer" | "owner";
  purpose: string;
  lead: {
    id: string;
    code: string;
    kind: "Rent" | "Buy";
    status: string;
    customerName: string;
    property: string;
    ownerAck: boolean;
    verified: boolean;
    customerInspected: boolean | null;
    ownerInspected: boolean | null;
  };
}

/** Looks up an emailed link. Says why it cannot be used, or returns who it is for and what about. */
export async function readPartyToken(token: string): Promise<PartyVisit | "invalid" | "expired" | "used"> {
  if (!/^[0-9a-f]{64}$/.test(token)) return "invalid";
  const { data: t } = await supabaseAdmin()
    .from("party_tokens")
    .select("token_hash, party, purpose, expires_at, used_at, lead:leads(id, code, kind, status, customer_name, owner_ack_at, completion_verified_at, customer_inspected, owner_inspected, listing:listings(title, location))")
    .eq("token_hash", hash(token))
    .maybeSingle();
  if (!t) return "invalid";
  if (t.used_at) return "used";
  if (new Date(t.expires_at) < new Date()) return "expired";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const l = t.lead as any;
  return {
    tokenHash: t.token_hash,
    party: t.party,
    purpose: t.purpose,
    lead: {
      id: l.id,
      code: l.code,
      kind: l.kind,
      status: l.status,
      customerName: l.customer_name,
      property: l.listing ? `${l.listing.title}, ${l.listing.location}` : "the property",
      ownerAck: !!l.owner_ack_at,
      verified: !!l.completion_verified_at,
      customerInspected: l.customer_inspected,
      ownerInspected: l.owner_inspected,
    },
  };
}

export const useUpToken = async (tokenHash: string) =>
  supabaseAdmin().from("party_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", tokenHash);

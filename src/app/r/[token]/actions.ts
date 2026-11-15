"use server";

import { createHash } from "node:crypto";
import { failWith } from "@/lib/errors";
import { sendEmail } from "@/lib/n8n";
import { partyLink, readPartyToken, useUpToken } from "@/lib/party";
import { allow, clientKey } from "@/lib/ratelimit";
import { REFUSED, cleanText, looksLikeInstructions } from "@/lib/sanitize";
import { confirmedText, inspectionText } from "@/lib/leads";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { naira, parseNaira } from "@/lib/validation";

type Result = { error: string | null };
const GONE = "This link can no longer be used. Ask us for a new one.";

export interface InspectionProposal {
  /** True when the customer's own preferred time suits the owner. */
  agree: boolean;
  /** Up to three times that suit the owner, as "2026-11-21T10:00" in Lagos time. */
  times: string[];
  note: string;
}

const MAX_TIMES = 3;
const WINDOW_DAYS = 30;

/** The owner confirms they have received the customer, and says which inspection times suit them. */
export async function acknowledge(token: string, proposal: InspectionProposal): Promise<Result> {
  const visit = await readPartyToken(token);
  if (typeof visit === "string" || visit.purpose !== "owner-ack" || visit.party !== "owner") return { error: GONE };
  const { lead } = visit;

  const asked = !!lead.inspectionDate;
  const agree = asked && proposal?.agree === true;
  const times = agree ? [] : [...new Set((Array.isArray(proposal?.times) ? proposal.times : []).filter((t): t is string => typeof t === "string" && t !== ""))];
  if (!agree && times.length === 0) return { error: asked ? "Choose whether the customer's time suits you, or add at least one time that does." : "Add at least one time that suits you for the inspection." };
  if (times.length > MAX_TIMES) return { error: `Add no more than ${MAX_TIMES} times.` };
  const now = Date.now();
  const stamps: string[] = [];
  for (const t of times) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return { error: "Choose each time with the date and time boxes." };
    const at = new Date(`${t}:00+01:00`).getTime();
    if (!Number.isFinite(at) || at < now) return { error: "Choose times that have not passed." };
    if (at > now + WINDOW_DAYS * 86_400_000) return { error: `Choose times within the next ${WINDOW_DAYS} days.` };
    stamps.push(`${t}:00+01:00`);
  }
  const text = cleanText(proposal?.note ?? "", 300, true);
  if (looksLikeInstructions(text)) return { error: REFUSED };

  const patch: Record<string, unknown> = { owner_proposed_times: stamps, owner_proposed_note: text, owner_agreed_customer_time: asked ? agree : null, owner_proposed_at: new Date().toISOString() };
  if (!lead.ownerAck) patch.owner_ack_at = new Date().toISOString(); // the database writes "Owner: Acknowledged receipt of this customer" into the history
  const db = supabaseAdmin();
  const { error } = await db.from("leads").update(patch).eq("id", lead.id);
  if (error) return { error: "We could not record that just now. Please try again." };
  await useUpToken(visit.tokenHash);

  const summary = agree ? `The customer's preferred time suits the owner (${inspectionText(lead.inspectionDate, lead.inspectionSlot)}).` : `Times that suit the owner: ${stamps.map(confirmedText).join("; ")}.`;
  await db.from("audit").insert({ lead_id: lead.id, actor: "Owner", action: "Gave inspection times", detail: text ? `${summary} Note: ${text}` : summary });
  // The team picks the final time that works for both, then releases the contact.
  await sendEmail({
    to: "team",
    subject: `Owner acknowledged and gave inspection times - ${lead.code}`,
    heading: "Pick the inspection time",
    paragraphs: ["The owner acknowledged this customer and told us which inspection times suit them.", "Open the lead, confirm one time that works for both, then release the contact. The time goes out in the release email."],
    rows: [["Lead", lead.code], ["Property", lead.property], ["Customer asked for", inspectionText(lead.inspectionDate, lead.inspectionSlot) || "No time given"], ["Owner", agree ? "The customer's time suits" : stamps.map(confirmedText).join("; ")], ["Owner's note", text]],
  });
  return { error: null };
}

export interface FollowUpAnswer {
  inspected: boolean;
  completed: boolean;
  /** Owner only, when the deal is completed. */
  date?: string;
  price?: string;
  evidence?: string;
}

/** A customer or owner answers the follow-up: did the inspection take place, and was the deal completed? */
export async function answerFollowUp(token: string, answer: FollowUpAnswer): Promise<Result> {
  const visit = await readPartyToken(token);
  if (typeof visit === "string" || visit.purpose !== "follow-up") return { error: GONE };
  const { lead, party } = visit;
  const db = supabaseAdmin();
  const patch: Record<string, unknown> = { [`${party}_inspected`]: !!answer.inspected, [`${party}_completed`]: !!answer.completed };

  // An owner who says the deal is done gives the date and the final amount, for us to check.
  const reporting = party === "owner" && answer.completed && !lead.verified;
  const price = parseNaira(answer.price ?? "");
  if (reporting) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(answer.date ?? "") || !price) return { error: "Enter the completion date and the final agreed amount." };
    Object.assign(patch, { completion_date: answer.date, final_price: price, evidence_note: (answer.evidence ?? "").trim().slice(0, 500) });
  }
  // Both sides confirming the inspection moves an early lead on to Inspection Completed.
  const otherInspected = party === "owner" ? lead.customerInspected : lead.ownerInspected;
  if (answer.inspected && otherInspected && ["Contact Released", "Inspection Scheduled"].includes(lead.status)) patch.status = "Inspection Completed";

  const { error } = await db.from("leads").update(patch).eq("id", lead.id);
  if (error) return { error: "We could not record your answers just now. Please try again." };
  await useUpToken(visit.tokenHash);

  if (reporting) {
    const deal = lead.kind === "Rent" ? "rental" : "sale";
    await db.from("audit").insert({
      lead_id: lead.id,
      actor: "Owner",
      action: `Reported a completed ${deal}`,
      detail: `${answer.date}, final amount ${naira(price)}. Waiting for the evidence to be checked.`,
    });
    // Nothing is invoiced on this claim alone: the team checks it first.
    await sendEmail({
      to: "team",
      subject: `Completed ${deal} reported - ${lead.code}`,
      heading: `An owner reported a completed ${deal}`,
      paragraphs: [
        `The owner of ${lead.property} says the ${deal} to the customer we introduced has been completed.`,
        "Check the evidence in the dashboard before confirming it. No invoice is issued until you do.",
      ],
      rows: [["Lead", lead.code], ["Completed on", answer.date ?? ""], ["Final agreed amount", naira(price)]],
    });
  }
  return { error: null };
}

const CLOSED = ["Successfully Rented", "Successfully Sold", "Unsuccessful", "Disputed"];

/**
 * Someone opened an expired link and asks for a new one. The new link goes only to the address already on the lead,
 * never to anything typed here, and the answer is always the same, so this page reveals nothing and cannot be used to spam anyone.
 */
export async function requestNewLink(token: string): Promise<Result> {
  const same = { error: null };
  if (!/^[0-9a-f]{64}$/.test(token)) return same;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  // A few tries per link and per address: each one can send an email.
  if (!(await allow(`newlink-token:${tokenHash}`, 2, 3600)) || !(await allow(`newlink-ip:${await clientKey()}`, 10, 3600))) {
    return { error: "A new link was already sent. Please check your email, or try again in an hour." };
  }

  const { data: t } = await supabaseAdmin()
    .from("party_tokens")
    .select("lead_id, party, purpose, expires_at, used_at, lead:leads(code, status, customer_name, customer_email, owner_ack_at, owner:owners(name, email), listing:listings(title, location))")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  // Only a link that expired unused, for a lead that is still open, gets a new one.
  if (!t || t.used_at || new Date(t.expires_at) > new Date() || !["owner-ack", "follow-up"].includes(t.purpose)) return same;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const l = t.lead as any;
  if (!l || CLOSED.includes(l.status) || (t.purpose === "owner-ack" && l.owner_ack_at)) return same;

  const owner = t.party === "owner";
  const to: string | undefined = owner ? l.owner?.email : l.customer_email;
  const name: string = (owner ? l.owner?.name : l.customer_name) ?? "";
  if (!to) return same;
  const property = l.listing ? `${l.listing.title}, ${l.listing.location}` : "the property";
  const link = await partyLink(t.lead_id, t.party, t.purpose, 2);
  if (!link) return { error: failWith("r.requestNewLink", "make_party_token returned nothing", { leadCode: l.code }) };

  const ack = t.purpose === "owner-ack";
  const sent = await sendEmail({
    to,
    subject: ack ? `A new link for ${property}` : `A new link: your enquiry ${l.code}`,
    heading: "Your new link",
    paragraphs: [
      `Hello ${name || "there"}, here is the new link you asked for.`,
      ack ? "Please acknowledge the introduction of the customer for this property." : "Please tell us whether the inspection took place and whether the deal was completed.",
    ],
    rows: [["Reference", l.code], ["Property", property]],
    button: { label: ack ? "Acknowledge this introduction" : "Answer the follow-up", url: link },
    footnote: "The link works once, for 48 hours, and is only for you. If you did not ask for it, you can ignore this email.",
  });
  if (!sent.body.success) return { error: "We could not send the email just now. Please try again in a few minutes." };
  return same;
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { LEAD_STATUSES, confirmedText, inspectionText, type LeadStatus } from "@/lib/leads";
import { sendContactRelease, sendEmail, sendFollowUp, type ContactRelease, type Email } from "@/lib/n8n";
import { partyLink, partyToken, siteUrl } from "@/lib/party";
import { startPayment, verifyPayment } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { naira, parseNaira } from "@/lib/validation";
import { withId } from "@/lib/errors";

type Result = { error: string | null };
const done = (): Result => {
  revalidatePath("/admin", "layout");
  return { error: null };
};
const isId = (id: string) => /^[0-9a-f-]{36}$/.test(id);

/**
 * Changes a lead as the signed-in person. The database checks the change against the rules
 * (release gate, status order, invoice order), writes the history, and its message is shown as is.
 */
async function change(id: string, patch: Record<string, unknown>): Promise<Result> {
  await requireUser("transactions");
  if (!isId(id)) return { error: "That lead could not be found." };
  const db = await supabaseServer();
  const { data, error } = await db.from("leads").update(patch).eq("id", id).select("id");
  if (error) return { error: error.code === "P0001" ? error.message : withId("leads", error, "The change could not be saved. Please try again.") };
  if (!data?.length) return { error: "That lead could not be found." };
  return done();
}

/** A note in the history for something the database does not record by itself. */
async function note(leadId: string, actor: string, action: string, detail = "") {
  await supabaseAdmin().from("audit").insert({ lead_id: leadId, actor, action, detail });
}

export const linkProperty = async (id: string, listingId: string) =>
  isId(listingId) ? change(id, { listing_id: listingId }) : { error: "Choose a property." };

export const declineLead = async (id: string) => change(id, { status: "Unsuccessful" });

export const setStatus = async (id: string, status: LeadStatus) =>
  LEAD_STATUSES.includes(status) ? change(id, { status }) : { error: "That status is not valid." };

/** Used when the owner has confirmed by phone or WhatsApp that they received this customer. */
export async function recordOwnerAck(id: string): Promise<Result> {
  const user = await requireUser("release");
  const res = await change(id, { owner_ack_at: new Date().toISOString() });
  if (!res.error) await note(id, user.name, "Recorded the owner's acknowledgement", "Confirmed with the owner directly.");
  return res.error ? res : done();
}

async function emailContact(id: string, actor: string, release: ContactRelease, again: boolean): Promise<Result> {
  const sent = await sendContactRelease(release);
  if (!sent.body.success) {
    await note(id, "System", "Contact email could not be sent", sent.body.error ?? "");
    return { error: "The contact details are released and recorded, but the email to the customer could not be sent. Use \u201cSend the email again\u201d." };
  }
  await note(id, actor, again ? "Contact email sent to the customer again" : "Contact email sent to the customer", release.customerEmail);
  return done();
}

/** Approves the enquiry: the database releases the contact only if every record is in place, then the customer is emailed. */
export async function releaseContact(id: string): Promise<Result> {
  const user = await requireUser("release");
  if (!isId(id)) return { error: "That lead could not be found." };
  const { data, error } = await supabaseAdmin().rpc("release_contact", { p_lead: id, p_actor: user.name });
  if (error || !data) return { error: error?.code === "P0001" ? error.message : withId("leads", error, "The contact could not be released. Please try again.") };
  revalidatePath("/admin", "layout");
  const rel = data as ContactRelease & { inspectionDate?: string; inspectionSlot?: string };
  return emailContact(id, user.name, { ...rel, inspection: inspectionText(rel.inspectionDate, rel.inspectionSlot) }, false);
}

export async function resendContact(id: string): Promise<Result> {
  const user = await requireUser("release");
  if (!isId(id)) return { error: "That lead could not be found." };
  const { data: l } = await supabaseAdmin()
    .from("leads")
    .select("code, customer_name, customer_email, released_at, inspection_date, inspection_slot, owner:owners(name, whatsapp, email), listing:listings(title, location)")
    .eq("id", id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const owner = l?.owner as any, listing = l?.listing as any;
  if (!l?.released_at || !owner || !listing) return { error: "Contact details for this lead have not been released." };
  return emailContact(id, user.name, {
    leadCode: l.code, customerName: l.customer_name, customerEmail: l.customer_email,
    ownerName: owner.name, ownerWhatsapp: owner.whatsapp, ownerEmail: owner.email,
    property: `${listing.title}, ${listing.location}`,
    inspection: inspectionText(l.inspection_date, l.inspection_slot),
    trackToken: (await partyToken(id, "customer", "track", 90)) ?? undefined,
  }, true);
}

export async function reportCompletion(id: string, date: string, price: string, evidence: string): Promise<Result> {
  const amount = parseNaira(price);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount) return { error: "Enter the completion date and the final agreed amount." };
  return change(id, { completion_date: date, final_price: amount, evidence_note: evidence.trim().slice(0, 500) });
}

/** Confirms the evidence was checked and marks the transaction successful. Only then can it be invoiced. */
export const verifyCompletion = async (id: string, status: LeadStatus) =>
  change(id, { completion_verified_at: new Date().toISOString(), status });

/** Everything the owner-facing emails need about one lead. */
async function leadForEmail(id: string) {
  const { data: l } = await supabaseAdmin()
    .from("leads")
    .select("*, owner:owners(name, email), listing:listings(title, location)")
    .eq("id", id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const owner = l?.owner as any, listing = l?.listing as any;
  if (!l || !owner || !listing) return null;
  return { l, owner: owner as { name: string; email: string }, property: `${listing.title}, ${listing.location}` as string };
}

/** Sends an email and records in the history whether it went. */
async function emailAndNote(id: string, actor: string, email: Email, what: string): Promise<Result> {
  const sent = await sendEmail(email);
  if (!sent.body.success) {
    await note(id, "System", `${what} could not be emailed`, sent.body.error ?? "");
    return { error: `${what} is recorded, but the email could not be sent. Try sending it again.` };
  }
  await note(id, actor, `${what} emailed`, email.to);
  return done();
}

/** Emails the owner a one-time link to acknowledge the customer being introduced. */
export async function requestOwnerAck(id: string): Promise<Result> {
  const user = await requireUser("release");
  const info = isId(id) ? await leadForEmail(id) : null;
  if (!info) return { error: "This lead has no property with an owner to ask." };
  if (info.l.owner_ack_at) return { error: "The owner has already acknowledged this customer." };
  const link = await partyLink(id, "owner", "owner-ack", 2);
  if (!link) return { error: "The link could not be created. Please try again." };
  return emailAndNote(id, user.name, {
    to: info.owner.email,
    subject: `A customer for ${info.property}`,
    heading: "A customer wants your property",
    paragraphs: [
      `Hello ${info.owner.name}, we are introducing ${info.l.customer_name} to you for ${info.property}.`,
      "Please acknowledge this introduction. Once you do, and we approve the enquiry, we send the customer your WhatsApp number and email so they can contact you directly.",
    ],
    rows: [
      ["Reference", info.l.code],
      ["Customer", info.l.customer_name],
      ["Property", info.property],
      ["Inspection the customer asked for", inspectionText(info.l.inspection_date, info.l.inspection_slot)],
    ],
    button: { label: "Acknowledge this introduction", url: link },
    footnote: "The link works once, for 48 hours, and is only for you.",
  }, "Acknowledgement request");
}

/** Sends the follow-up questions to the customer and the owner now, instead of waiting for the daily run. */
export async function sendFollowUpNow(id: string): Promise<Result> {
  const user = await requireUser("transactions");
  if (!isId(id)) return { error: "That lead could not be found." };
  const sent = await sendFollowUp(id, user.name, await siteUrl());
  if (!sent.body.success) return { error: sent.body.error ?? "The follow-up could not be sent." };
  await note(id, user.name, "Asked for the follow-up to be sent now");
  return done();
}

const invoiceEmail = (info: NonNullable<Awaited<ReturnType<typeof leadForEmail>>>, reference: string, payUrl: string): Email => {
  const { l } = info;
  const rent = l.kind === "Rent";
  return {
    to: info.owner.email,
    subject: `Invoice ${reference}: ${rent ? "agency fee" : "sale commission"} for ${info.property}`,
    heading: rent ? "Invoice for your agency fee" : "Invoice for your sale commission",
    paragraphs: [
      `Hello ${info.owner.name}, the ${rent ? "rental" : "sale"} of ${info.property} to the customer we introduced has been completed, so the fee you agreed to is now due.`,
    ],
    rows: [
      ["Invoice", reference],
      ["Property", info.property],
      ["Customer introduced", l.customer_name],
      ["Completed on", l.completion_date],
      [rent ? "Final agreed annual rent" : "Final agreed price", naira(l.final_price)],
      ["Agreed rate", `${Number(l.fee_pct)}% (agreement version ${l.agreement_version})`],
      ["Amount due", naira(l.fee_amount)],
    ],
    button: { label: `Pay ${naira(l.fee_amount)} now`, url: payUrl },
    footnote: "This fee is separate from the listing fee you paid when you listed the property. You will get a receipt once the payment is confirmed.",
  };
};

/** Issues the invoice for a checked completion (or sends it again): creates a Paystack payment page and emails it to the owner. */
export async function issueInvoice(id: string): Promise<Result> {
  const user = await requireUser("transactions");
  const info = isId(id) ? await leadForEmail(id) : null;
  if (!info) return { error: "This lead has no property with an owner to invoice." };
  const { l } = info;
  if (!l.completion_verified_at || !l.fee_amount) return { error: "No invoice can be issued until the completion has been checked." };
  if (l.invoice_status === "Paid") return { error: "This invoice has already been paid." };
  const reference = `${l.code}-INV-${Date.now().toString(36).toUpperCase()}`;
  const payUrl = await startPayment(info.owner.email, l.fee_amount, reference);
  if (!payUrl) return { error: "Paystack could not create the payment page, so the invoice was not issued. Please try again." };
  const again = l.invoice_status === "Issued";
  // The database checks the completion again and records the invoice in the history.
  const saved = await change(id, again ? { payment_reference: reference } : { invoice_status: "Issued", payment_reference: reference });
  if (saved.error) return saved;
  return emailAndNote(id, user.name, invoiceEmail({ ...info, l: { ...l, payment_reference: reference } }, reference, payUrl), again ? "Invoice (sent again)" : "Invoice");
}

async function markPaid(id: string, actor: string, how: string): Promise<Result> {
  const saved = await change(id, { invoice_status: "Paid" });
  if (saved.error) return saved;
  const info = await leadForEmail(id);
  if (!info) return done();
  const { l } = info;
  await note(id, actor, "Payment confirmed", how);
  return emailAndNote(id, actor, {
    to: info.owner.email,
    subject: `Receipt ${l.receipt_code}: payment received for ${info.property}`,
    heading: "Payment received",
    paragraphs: [`Hello ${info.owner.name}, thank you. We have received your payment and this is your receipt.`],
    rows: [
      ["Receipt", l.receipt_code],
      ["Amount paid", naira(l.fee_amount)],
      ["For", `${l.kind === "Rent" ? "Agency fee" : "Sale commission"}, ${info.property}`],
      ["Reference", l.code],
      ["Invoice", l.payment_reference ?? ""],
    ],
  }, "Receipt");
}

/** Asks Paystack whether the invoice was paid. If it was, marks it paid and emails the receipt. */
export async function checkPayment(id: string): Promise<Result> {
  const user = await requireUser("transactions");
  const info = isId(id) ? await leadForEmail(id) : null;
  if (!info || info.l.invoice_status !== "Issued" || !info.l.payment_reference) return { error: "There is no issued invoice to check." };
  const paid = await verifyPayment(info.l.payment_reference, info.l.fee_amount);
  if (paid === "unreachable" || paid === "not-configured") return { error: "Paystack could not be reached just now. Please try again." };
  if (paid !== "paid") return { error: "Paystack shows no successful payment for this invoice yet." };
  return markPaid(id, user.name, `Verified with Paystack, reference ${info.l.payment_reference}.`);
}

/** For a payment that arrived another way (for example a bank transfer) and that someone has checked by hand. */
export async function recordManualPayment(id: string): Promise<Result> {
  const user = await requireUser("transactions");
  if (!isId(id)) return { error: "That lead could not be found." };
  return markPaid(id, user.name, "Recorded by hand: paid outside Paystack and confirmed by this person.");
}

/**
 * The team confirms the inspection time with the owner and customer. `local` is what a date-and-time box gives
 * ("2026-11-21T10:00"), in Lagos time. The database moves the lead to Inspection Scheduled and writes the history;
 * then the customer and the owner are both emailed the time.
 */
export async function confirmInspection(id: string, local: string): Promise<Result> {
  const user = await requireUser("transactions");
  if (!isId(id)) return { error: "That lead could not be found." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return { error: "Choose the date and time." };
  const { data, error } = await supabaseAdmin().rpc("confirm_inspection", { p_lead: id, p_when: `${local}:00+01:00`, p_actor: user.name });
  if (error || !data) return { error: error?.code === "P0001" ? error.message : withId("leads", error, "The inspection time could not be saved. Please try again.") };
  const c = data as { leadCode: string; customerName: string; customerEmail: string; ownerName: string; ownerEmail: string; property: string; when: string; trackToken: string };
  const when = confirmedText(c.when);
  const origin = await siteUrl();

  const results = await Promise.all([
    sendEmail({
      to: c.customerEmail,
      subject: `Your inspection is confirmed: ${c.property}`,
      heading: "Your inspection is confirmed",
      paragraphs: [`Hello ${c.customerName.split(" ")[0]}, your inspection of ${c.property} is confirmed for ${when} (Lagos time).`, "Please be on time. If you need to change it, reply to this email or message us on WhatsApp."],
      rows: [["Property", c.property], ["When", when], ["Your reference", c.leadCode]],
      button: { label: "Track your enquiry", url: `${origin}/track/${c.trackToken}` },
    }),
    sendEmail({
      to: c.ownerEmail,
      subject: `Inspection booked: ${c.property}`,
      heading: "An inspection is booked",
      paragraphs: [`Hello ${c.ownerName}, ${c.customerName} will inspect ${c.property} on ${when} (Lagos time).`, "Please make sure someone is there to show the property."],
      rows: [["Property", c.property], ["Customer", c.customerName], ["When", when], ["Reference", c.leadCode]],
    }),
  ]);
  const failed = results.filter((r) => !r.body.success).length;
  await note(id, failed ? "System" : user.name, failed ? "Inspection confirmation could not be emailed to everyone" : "Inspection confirmation emailed to the customer and the owner", when);
  revalidatePath("/admin", "layout");
  return failed ? { error: "The time is saved, but not every email could be sent. Check the history, and tell them yourself if needed." } : { error: null };
}

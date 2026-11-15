"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/submissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { withId } from "@/lib/errors";
import { sendEmail } from "@/lib/n8n";
import { emailOwnerPublished } from "@/lib/owner-notice";
import { siteUrl } from "@/lib/party";
import { refundPayment, refundStatus } from "@/lib/paystack";
import { allow } from "@/lib/ratelimit";
import { reasonById, refundCompletedEmail, refundStartedEmail, rejectionEmail } from "@/lib/refunds";
import { cleanText } from "@/lib/sanitize";

type Result = { error: string | null; listingCode?: string; info?: string };
const isId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
const done = (extra: Partial<Result> = {}): Result => {
  revalidatePath("/admin", "layout");
  return { error: null, ...extra };
};

export async function markRead(id: string): Promise<Result> {
  await requireUser("submissions");
  if (!isId(id)) return { error: "That submission could not be found." };
  await (await supabaseServer()).from("submissions").update({ unread: false }).eq("id", id);
  return done();
}

/** Contacted or Rejected (or back to New). Approving goes through `approveSubmission`. */
export async function setSubmissionStatus(id: string, status: SubmissionStatus): Promise<Result> {
  const user = await requireUser(status === "Rejected" ? "approve" : "submissions");
  if (status === "Rejected") return { error: "Use the Reject submission button: it records the reason, emails the owner and handles the refund." };
  if (!isId(id) || !SUBMISSION_STATUSES.includes(status) || status === "Approved") return { error: "That status is not valid." };
  const db = await supabaseServer();
  const { error } = await db.from("submissions").update({ status, unread: false }).eq("id", id);
  if (error) return { error: withId("submissions", error, "The status could not be changed. Please try again.") };
  await supabaseAdmin().from("audit").insert({ submission_id: id, actor: user.name, action: "Submission status changed", detail: status });
  return done();
}

/**
 * Turns a submission into a property, as an unpublished draft that keeps the owner and their agreement.
 * The photos are copied from the private submissions bucket to the public listings bucket.
 */
export async function approveSubmission(id: string): Promise<Result> {
  const user = await requireUser("approve");
  if (!isId(id)) return { error: "That submission could not be found." };
  const admin = supabaseAdmin();
  const { data: s } = await admin.from("submissions").select("*, submission_images(path, position), listings(code)").eq("id", id).single();
  if (!s) return { error: "That submission could not be found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const existing = (s.listings as any[])?.[0]?.code as string | undefined;
  if (existing) return done({ listingCode: existing });

  const kind = String(s.property_type).toLowerCase();
  const { data: listing, error } = await admin
    .from("listings")
    .insert({
      category: s.purpose === "Rent" ? "Rent" : "Buy",
      property_type: s.property_type,
      title: s.bedrooms ? `${s.bedrooms}-bedroom ${kind}` : s.property_type,
      location: s.neighbourhood,
      price: s.asking_amount,
      beds: s.bedrooms,
      description: s.description,
      details: s.details,
      legal_fee: s.legal_fee,
      caution_pct: s.caution_pct,
      service_charge: s.service_charge,
      service_covers: s.service_covers,
      facilities: s.facilities,
      parking: s.parking,
      security: s.security,
      inspection: s.inspection,
      video_url: s.video_url,
      owner_id: s.owner_id,
      agreement_id: s.agreement_id,
      submission_id: s.id,
      published: false,
      verified: false,
    })
    .select("id, code")
    .single();
  if (error || !listing) return { error: withId("submissions", error, "The property could not be created. Please try again.") };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const photos = [...(s.submission_images as any[])].sort((a, b) => a.position - b.position);
  const copied: { listing_id: string; path: string; position: number }[] = [];
  for (const [position, photo] of photos.entries()) {
    const path = `${crypto.randomUUID()}.jpg`;
    const file = await admin.storage.from("submissions").download(photo.path);
    if (file.error || !file.data) continue;
    const put = await admin.storage.from("listings").upload(path, file.data, { contentType: "image/jpeg" });
    if (!put.error) copied.push({ listing_id: listing.id, path, position });
  }
  if (copied.length) await admin.from("listing_images").insert(copied);

  await admin.from("submissions").update({ status: "Approved", unread: false }).eq("id", id);
  await admin.from("audit").insert({
    submission_id: id,
    actor: user.name,
    action: "Submission approved",
    detail: `Property ${listing.code} created as a draft with ${copied.length} of ${photos.length} photos.`,
  });
  revalidatePath("/admin/properties");
  return done({ listingCode: listing.code });
}

/**
 * The "Send approval email to owner" button: tells the owner their property was approved and is on the website,
 * with the link to see it. Works the first time and again later. The property must be published.
 */
export async function sendApprovalEmail(submissionId: string): Promise<Result> {
  const user = await requireUser("approve");
  if (!isId(submissionId)) return { error: "That submission could not be found." };
  const { data: listing } = await supabaseAdmin().from("listings").select("id").eq("submission_id", submissionId).maybeSingle();
  if (!listing) return { error: "Approve this submission first: there is no property for it yet." };
  const sent = await emailOwnerPublished(listing.id as string, { manual: true, actor: user.name });
  return sent.error ? sent : done();
}

// ───────────────────────────── Rejecting a submission, and refunding the listing fee ─────────────────────────────

interface Loaded {
  id: string;
  code: string;
  status: string;
  agreementId: string;
  paymentRef: string;
  fee: number;
  hasListing: boolean;
  rejectedReason: string | null;
  owner: { name: string; email: string };
  property: string;
}

async function load(id: string): Promise<Loaded | null> {
  const { data } = await supabaseAdmin()
    .from("submissions")
    .select("id, code, status, property_type, neighbourhood, rejected_reason, owner:owners(name, email), agreement:agreements(id, listing_fee, payment_reference), listings(id)")
    .eq("id", id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  const s = data as any;
  const owner = Array.isArray(s?.owner) ? s.owner[0] : s?.owner;
  const agreement = Array.isArray(s?.agreement) ? s.agreement[0] : s?.agreement;
  if (!s || !owner || !agreement) return null;
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    agreementId: agreement.id,
    paymentRef: agreement.payment_reference,
    fee: Number(agreement.listing_fee),
    hasListing: Array.isArray(s.listings) && s.listings.length > 0,
    rejectedReason: s.rejected_reason ?? null,
    owner: { name: owner.name, email: owner.email },
    property: `${s.property_type}, ${s.neighbourhood}`,
  };
}

const audit = (submissionId: string, actor: string, action: string, detail = "") =>
  supabaseAdmin().from("audit").insert({ submission_id: submissionId, actor, action, detail });

const who = (s: Loaded) => ({ name: s.owner.name, code: s.code, property: s.property, fee: s.fee });

/**
 * Starts the Paystack refund of the full listing fee. The refund is claimed in the database first: the one-refund-per-fee
 * rule there means a double click, or two people, can never refund the same fee twice. A failed one can be tried again.
 */
async function startRefund(s: Loaded, actor: string, reason: string, notifyOwner: boolean): Promise<Result> {
  const admin = supabaseAdmin();
  const { data: row, error } = await admin
    .from("refunds")
    .insert({ submission_id: s.id, agreement_id: s.agreementId, payment_reference: s.paymentRef, amount: s.fee, method: "Paystack", reason, created_by: actor })
    .select("id")
    .single();
  if (error || !row) {
    return { error: error?.code === "23505" ? "A refund for this listing fee has already been started or completed." : withId("refunds", error ?? "no row", "The refund could not be started. Please try again.") };
  }
  const sent = await refundPayment(s.paymentRef, s.fee, { merchant: `Listing fee refund for ${s.code}: ${reason}`, customer: `Refund of your listing fee for ${s.code}` });
  if (!sent.ok) {
    await admin.from("refunds").update({ status: "Failed", failure: sent.message.slice(0, 300) }).eq("id", row.id);
    await audit(s.id, actor, "Refund could not be started", sent.message);
    return { error: `Paystack could not start the refund: ${sent.message} You can try again, or record a refund you made another way.` };
  }
  const instantly = sent.state === "processed";
  await admin
    .from("refunds")
    .update({ paystack_refund_id: sent.id || null, ...(instantly ? { status: "Refunded", completed_at: new Date().toISOString() } : {}) })
    .eq("id", row.id);
  await audit(s.id, actor, instantly ? "Refund completed" : "Refund started", `${s.fee} naira to the card or account of payment ${s.paymentRef}. ${reason}`);
  if (notifyOwner) {
    await sendEmail({ to: s.owner.email, ...(instantly ? refundCompletedEmail(who(s), "back to the card you paid with") : refundStartedEmail(who(s))) });
  }
  return { error: null };
}

/**
 * Rejects a submission: records the reason, emails the owner (why, and what happens to the listing fee), and, when the
 * refund is to be made and the person may send refunds, starts it. Without that permission the decision is recorded and
 * someone who has it sends the refund later.
 */
export async function rejectSubmission(id: string, reasonId: string, note: string, refund: boolean): Promise<Result> {
  const user = await requireUser("approve");
  const reason = reasonById(reasonId);
  note = cleanText(note, 500);
  if (!isId(id) || !reason) return { error: "Choose a reason." };
  if (reason.id === "other" && note.length < 3) return { error: "Write the reason in the note, so the owner understands." };
  if (!(await allow(`reject:${user.id}`, 30, 3600))) return { error: "Too many tries. Please wait a few minutes." };
  const s = await load(id);
  if (!s) return { error: "That submission could not be found." };
  if (s.hasListing || s.status === "Approved") return { error: "This submission was already approved and has a property, so it cannot be rejected here." };
  if (s.status === "Rejected") return { error: "This submission was already rejected." };

  const { error } = await supabaseAdmin()
    .from("submissions")
    .update({ status: "Rejected", unread: false, rejected_reason: reason.id, rejected_note: note || null, refund_decision: !!refund })
    .eq("id", id);
  if (error) return { error: withId("submissions", error, "The submission could not be rejected. Ask your developer to check that database migration 0013 has been run.") };
  await audit(id, user.name, "Submission rejected", `${reason.label}. Refund: ${refund ? "yes" : "no"}.${note ? ` Note to the owner: ${note}` : ""}`);

  const problems: string[] = [];
  const mail = await sendEmail({ to: s.owner.email, ...rejectionEmail(who(s), reason, note, !!refund, `${await siteUrl()}/legal/refunds`) });
  if (!mail.body.success) problems.push("The submission is rejected, but the email to the owner could not be sent. Tell them yourself, or use the contact details on the submission.");
  if (refund && user.permissions.includes("refunds")) {
    const started = await startRefund(s, user.name, reason.label, false);
    if (started.error) problems.push(started.error);
  } else if (refund) {
    problems.push("The submission is rejected and the owner knows the fee will be refunded. Someone with the refunds permission must now send the refund.");
  }
  revalidatePath("/admin", "layout");
  return problems.length ? { error: problems.join(" ") } : { error: null };
}

/** The "Refund the listing fee" button. Needs the refunds permission. Also used to refund when it was first decided not to. */
export async function refundListingFee(id: string): Promise<Result> {
  const user = await requireUser("refunds");
  if (!isId(id)) return { error: "That submission could not be found." };
  if (!(await allow(`refund:${user.id}`, 10, 3600))) return { error: "Too many tries. Please wait a few minutes." };
  const s = await load(id);
  if (!s) return { error: "That submission could not be found." };
  if (s.status !== "Rejected") return { error: "Only a rejected submission can be refunded." };
  const reason = reasonById(s.rejectedReason ?? "")?.label ?? "Submission rejected";
  const res = await startRefund(s, user.name, reason, true);
  revalidatePath("/admin", "layout");
  return res;
}

/** Asks Paystack where a started refund has got to (until Paystack tells us itself). */
export async function checkRefund(id: string): Promise<Result> {
  const user = await requireUser("refunds");
  if (!isId(id)) return { error: "That submission could not be found." };
  if (!(await allow(`refund-check:${user.id}`, 30, 3600))) return { error: "Too many checks. Please wait a few minutes." };
  const s = await load(id);
  if (!s) return { error: "That submission could not be found." };
  const admin = supabaseAdmin();
  const { data: row } = await admin.from("refunds").select("id").eq("submission_id", id).eq("status", "Started").eq("method", "Paystack").maybeSingle();
  if (!row) return { error: "There is no started refund to check." };
  const now = await refundStatus(s.paymentRef);
  if (!now.ok) return { error: now.message };
  if (now.state === "processed") {
    await admin.from("refunds").update({ status: "Refunded", completed_at: new Date().toISOString() }).eq("id", row.id);
    await audit(id, user.name, "Refund completed", "Paystack reports the refund as processed.");
    await sendEmail({ to: s.owner.email, ...refundCompletedEmail(who(s), "back to the card you paid with") });
    revalidatePath("/admin", "layout");
    return { error: null, info: "Paystack says the refund is complete. The owner was emailed." };
  }
  if (now.state === "failed") {
    await admin.from("refunds").update({ status: "Failed", failure: "Paystack could not complete the refund." }).eq("id", row.id);
    await audit(id, user.name, "Refund failed", "Paystack reports the refund as failed.");
    revalidatePath("/admin", "layout");
    return { error: "Paystack could not complete the refund. You can try again, or record a refund you made another way." };
  }
  return { error: null, info: now.state === "needs-attention" ? "Paystack says this refund needs attention. Check it in your Paystack dashboard." : "Paystack is still processing the refund. This normally takes 5 to 10 working days." };
}

/** For a refund made outside this system (the Paystack dashboard, a bank transfer). Recorded as done, with who and what. */
export async function recordManualRefund(id: string, note: string): Promise<Result> {
  const user = await requireUser("refunds");
  note = cleanText(note, 300);
  if (!isId(id)) return { error: "That submission could not be found." };
  if (note.length < 5) return { error: "Say how it was refunded and when, for example: bank transfer on 20 Nov, receipt 12345." };
  if (!(await allow(`refund:${user.id}`, 10, 3600))) return { error: "Too many tries. Please wait a few minutes." };
  const s = await load(id);
  if (!s) return { error: "That submission could not be found." };
  if (s.status !== "Rejected") return { error: "Only a rejected submission can be refunded." };
  const { error } = await supabaseAdmin().from("refunds").insert({
    submission_id: s.id,
    agreement_id: s.agreementId,
    payment_reference: s.paymentRef,
    amount: s.fee,
    method: "Manual",
    status: "Refunded",
    reason: reasonById(s.rejectedReason ?? "")?.label ?? "Submission rejected",
    note,
    created_by: user.name,
    completed_at: new Date().toISOString(),
  });
  if (error) return { error: error.code === "23505" ? "A refund for this listing fee has already been started or completed." : withId("refunds", error, "The refund could not be recorded. Please try again.") };
  await audit(id, user.name, "Refund recorded", `Made outside this system. ${note}`);
  await sendEmail({ to: s.owner.email, ...refundCompletedEmail(who(s), "sent to you directly") });
  revalidatePath("/admin", "layout");
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/submissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { withId } from "@/lib/errors";
import { emailOwnerPublished } from "@/lib/owner-notice";

type Result = { error: string | null; listingCode?: string };
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

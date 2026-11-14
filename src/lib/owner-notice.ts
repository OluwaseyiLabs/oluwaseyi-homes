import "server-only";
import { withId } from "./errors";
import { sendEmail } from "./n8n";
import { siteUrl } from "./party";
import { propertyPath } from "./slug";
import { supabaseAdmin } from "./supabase/admin";
import { naira } from "./validation";

/**
 * Emails the owner that their property has been approved and is on the website, with the link to see it.
 *
 * - Automatic (the default): sent once, the first time the property is published. A draft, a property with no owner
 *   or an owner who was already told is skipped quietly.
 * - Manual (the "Send approval email to owner" button): sent whenever asked, even again, and every reason it cannot
 *   be sent is explained.
 *
 * Returns an error message only when something should be shown to the team.
 */
export async function emailOwnerPublished(listingId: string, opts: { manual?: boolean; actor?: string } = {}): Promise<{ error: string | null }> {
  const manual = !!opts.manual;
  const admin = supabaseAdmin();
  const { data, error: lookup } = await admin
    .from("listings")
    .select("code, title, location, category, price, published, owner_notified_at, submission_id, owner:owners(name, email)")
    .eq("id", listingId)
    .maybeSingle();
  // A failed lookup must not look like "nothing to send": it usually means migration 0012 has not been run yet.
  if (lookup) return { error: withId("owner-notice", lookup, "The property is saved, but the owner's email could not be prepared. Ask your developer to check that database migration 0012 has been run.") };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined row
  const l = data as any;
  const owner = Array.isArray(l?.owner) ? l.owner[0] : l?.owner;
  if (!l) return manual ? { error: "That property could not be found." } : { error: null };
  if (!l.published) return manual ? { error: "This property is not on the website yet, so there is nothing for the owner to look at. Publish it under Properties first, then send the email." } : { error: null };
  if (!owner?.email) return manual ? { error: "This property has no owner email address on record." } : { error: null };
  if (!manual && l.owner_notified_at) return { error: null };

  const rent = l.category === "Rent";
  const link = `${await siteUrl()}${propertyPath({ id: l.code, title: l.title, location: l.location })}`;
  const sent = await sendEmail({
    to: owner.email,
    subject: `Your property is now live: ${l.title}`,
    heading: "Your property has been approved",
    paragraphs: [
      `Hello ${owner.name}, good news: your property ${rent ? "to rent" : "for sale"} has been approved by our team and is now published on our website.`,
      "Customers can find it now. Use the button below to see exactly how it looks to them.",
    ],
    rows: [
      ["Reference", l.code],
      ["Property", l.title],
      ["Location", l.location],
      [rent ? "Annual rent" : "Asking price", naira(Number(l.price))],
    ],
    button: { label: "View your listing", url: link },
    footnote:
      "When a customer enquires about it, we email you a link to acknowledge the introduction. Your contact details go to the customer only after that and our approval. If anything in the listing needs correcting, reply to this email or message us on WhatsApp.",
  });
  if (!sent.body.success) return { error: withId("owner-notice", sent.body.error ?? "The email was not sent", "The property is saved and published, but the email to the owner could not be sent. Save the property again to try once more.", { listing: l.code }) };

  await admin.from("listings").update({ owner_notified_at: new Date().toISOString() }).eq("id", listingId);
  if (l.submission_id) {
    await admin.from("audit").insert({
      submission_id: l.submission_id,
      actor: manual ? opts.actor || "Team" : "System",
      action: manual ? "Approval email sent to the owner" : "Owner emailed: property approved and published",
      detail: `${owner.email}. ${l.code} is live at ${link}`,
    });
  }
  return { error: null };
}

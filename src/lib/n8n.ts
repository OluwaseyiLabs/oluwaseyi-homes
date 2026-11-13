import "server-only";
import { failWith } from "./errors";
import { getSiteContent } from "./data";
import { ownerChatMessage } from "./messages";
import { siteUrl } from "./party";
import { waLink } from "./site";
import type { ApiResponse, LeadInput } from "./validation";

const fail = (error: string): ApiResponse => ({ success: false, data: null, error });

/** Server-only: posts to an n8n webhook with Header Auth. Always resolves to the contract shape. */
async function post(
  url: string | undefined,
  body: BodyInit,
  contentType: string | null,
  timeoutMs: number,
): Promise<{ status: number; body: ApiResponse }> {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const header = process.env.N8N_WEBHOOK_HEADER || "x-webhook-secret";
  if (!url || !secret) {
    return { status: 500, body: fail(failWith("n8n.post", "N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is missing")) };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      // For FormData the runtime sets the multipart Content-Type itself.
      headers: { ...(contentType ? { "Content-Type": contentType } : {}), [header]: secret },
      body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as ApiResponse | null;
    if (json && typeof json.success === "boolean") {
      return { status: res.ok ? 200 : res.status, body: json };
    }
    // n8n rejects bad Header Auth with its own 403 (not our shape).
    return { status: 502, body: fail(failWith("n8n.post", `n8n answered ${res.status} without the expected JSON`, { host: new URL(url).host })) };
  } catch (e) {
    return { status: 504, body: fail(failWith("n8n.post", e, { host: new URL(url).host })) };
  }
}

/** An enquiry (n8n emails a code), or the code that confirms it (n8n registers the lead). */
export const submitLead = (lead: (LeadInput | { action: "verify"; email: string; code: string }) & { siteUrl?: string }) =>
  post(process.env.N8N_WEBHOOK_URL, JSON.stringify(lead), "application/json", 20_000);

/** A paid owner submission. The photos are already in storage; n8n stores the record and notifies the team. */
export const submitListing = (submission: Record<string, unknown>) =>
  post(process.env.N8N_LISTING_WEBHOOK_URL, JSON.stringify(submission), "application/json", 30_000);

export interface ContactRelease {
  /** The customer's private link to follow their enquiry. */
  trackToken?: string;
  /** What the customer asked for, for example "Saturday 21 November 2026, morning". */
  inspection?: string;
  leadCode: string;
  customerName: string;
  customerEmail: string;
  ownerName: string;
  ownerWhatsapp: string;
  ownerEmail: string;
  property: string;
}

export interface Email {
  /** An email address, or "team" for the company's own inbox. */
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  /** Label and value pairs shown in a box. Empty values are left out. */
  rows?: [string, string][];
  button?: { label: string; url: string };
  /** Up to three buttons, in order. Used instead of `button` when there are several. */
  buttons?: { label: string; url: string }[];
  footnote?: string;
}

/** Sends one branded email through n8n. */
export const sendEmail = (email: Email) =>
  post(process.env.N8N_WEBHOOK_URL, JSON.stringify({ action: "send-email", ...email }), "application/json", 30_000);

/** Emails the owner's contact details to a customer whose enquiry was approved. */
export const sendContactRelease = async (r: ContactRelease) => {
  const { site } = await getSiteContent();
  const origin = await siteUrl();
  return sendEmail({
    to: r.customerEmail,
    subject: `The owner's contact details for ${r.property}`,
    heading: "Your enquiry is approved",
    paragraphs: [
      `Hello ${r.customerName.split(" ")[0]}, here are the contact details of the owner of the property you asked about. You can now contact them directly.`,
      ...(r.inspection ? [`You asked to inspect it on ${r.inspection}. The owner has this request. Your inspection time is confirmed by email once it is agreed.`] : []),
    ],
    rows: [
      ["Property", r.property],
      ["Owner", r.ownerName],
      ["WhatsApp", r.ownerWhatsapp],
      ["Email", r.ownerEmail],
      ["Your reference", r.leadCode],
    ],
    // The chat opens with a message already written, quoting the reference.
    buttons: [
      {
        label: "Message the owner on WhatsApp",
        url: waLink(r.ownerWhatsapp, ownerChatMessage({ company: site.name, customerName: r.customerName, ownerName: r.ownerName, property: r.property, leadCode: r.leadCode, inspection: r.inspection })),
      },
      ...(r.trackToken ? [{ label: "Track your enquiry", url: `${origin}/track/${r.trackToken}` }] : []),
    ],
    footnote: `This introduction was made by us under reference ${r.leadCode}. Please quote it when you contact the owner. We do not charge you an agency commission.`,
  });
};

/** Sends a follow-up for one lead now: n8n creates the two one-time links and emails the customer and the owner. */
export const sendFollowUp = (leadId: string, actor: string, siteUrl: string) =>
  post(process.env.N8N_WEBHOOK_URL, JSON.stringify({ action: "follow-up", leadId, actor, siteUrl }), "application/json", 30_000);

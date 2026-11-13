import { NextResponse } from "next/server";
import { submitLead } from "@/lib/n8n";
import { getFacilities } from "@/lib/data";
import { siteUrl } from "@/lib/party";
import { genericError, logError } from "@/lib/errors";
import { allow, clientKey } from "@/lib/ratelimit";
import { REFUSED, cleanEmail, cleanPhone, cleanText, looksLikeInstructions } from "@/lib/sanitize";
import { emptyLead, needsMatch, onlyFacilities, validateLead, type LeadInput } from "@/lib/validation";

const bad = (error: string, status = 400) => NextResponse.json({ success: false, data: null, error }, { status });
const tooMany = () => bad("You have tried too many times. Please wait a few minutes before trying again.", 429);
const tooFast = () => bad("That was very quick. Please slow down, check your details and send again in a few seconds.", 429);
/** What a bot is told: the same as a real success, so it learns nothing and does not retry. */
const pretend = () => NextResponse.json({ success: true, data: { message: "We have sent a 6-digit code to your email.", step: "code" }, error: null });
/** Fields that are free text, and how long each may be. Everything else is a fixed choice, a date or a number. */
const FREE_TEXT: Partial<Record<keyof LeadInput, [number, boolean]>> = {
  firstName: [60, false], lastName: [60, false], location: [120, false], budget: [60, false], specialRequirement: [1000, true],
};

/**
 * Two steps, both forwarded to the n8n Lead API:
 * 1. the enquiry: n8n emails a 6-digit code to the customer;
 * 2. `{ action: "verify", email, code }`: n8n registers the lead and returns its Lead ID.
 */
export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return bad("Invalid request.");
  try {
  const plain = (key: string, max: number) => (typeof raw[key] === "string" ? (raw[key] as string).trim().slice(0, max) : "");

  if (raw.action === "verify") {
    const code = plain("code", 12).replace(/\D/g, "");
    const email = cleanEmail(raw.email);
    if (code.length !== 6) return bad("Enter the 6-digit code from the email.");
    // Six digits can be guessed, so tries are limited per address and per email.
    if (!(await allow(`verify-ip:${await clientKey()}`, 20, 3600)) || !(await allow(`verify-email:${email}`, 8, 3600))) return tooMany();
    const { status, body } = await submitLead({ action: "verify", email, code, siteUrl: await siteUrl() });
    return NextResponse.json(body, { status });
  }

  // Spam: a hidden field only a bot fills in, and a form sent faster than a person can type it.
  if (plain("website", 200)) return pretend();
  const startedAt = Number(raw.startedAt);
  if (!Number.isFinite(startedAt)) return pretend(); // not our form
  const took = Date.now() - startedAt;
  if (took < 3000) return tooFast(); // a person is told to slow down; the form stays filled in
  if (took > 24 * 3600_000) return bad("This form has been open for a long time. Please reload the page and try again.");

  // Only forward known fields, cleaned.
  const lead = { ...emptyLead } as LeadInput;
  for (const key of Object.keys(emptyLead) as (keyof LeadInput)[]) {
    const free = FREE_TEXT[key];
    lead[key] = key === "email" ? cleanEmail(raw[key]) : key === "phone" ? cleanPhone(raw[key]) : free ? cleanText(raw[key], free[0], free[1]) : plain(key, 200);
  }
  if ((Object.keys(FREE_TEXT) as (keyof LeadInput)[]).some((k) => looksLikeInstructions(lead[k]))) return bad(REFUSED);

  const errors = validateLead(lead);
  if (Object.keys(errors).length > 0) return bad(Object.values(errors).join(" "));
  if (!(await allow(`lead-ip:${await clientKey()}`, 10, 3600)) || !(await allow(`lead-email:${lead.email}`, 3, 900))) return tooMany();

  lead.source = lead.source.replace(/[^\w .:-]/g, "").slice(0, 80);
  // Identifiers must look like identifiers.
  if (lead.listingId && !/^[\w-]{1,40}$/.test(lead.listingId)) lead.listingId = "";
  lead.facilities = onlyFacilities(lead.facilities, await getFacilities());
  if (!needsMatch(lead.enquiryType)) lead.moveInDate = lead.facilities = "";
  // An inspection is for a chosen property only.
  if (!lead.listingId || !needsMatch(lead.enquiryType) || !lead.inspectionDate) lead.inspectionDate = lead.inspectionSlot = "";
  if (lead.enquiryType !== "Rent" || lead.assistance !== "yes") lead.assistance = "";

  const { status, body } = await submitLead({ ...lead, siteUrl: await siteUrl() });
  return NextResponse.json(body, { status });
  } catch (e) {
    return bad(genericError(logError("api/leads", e)), 500);
  }
}

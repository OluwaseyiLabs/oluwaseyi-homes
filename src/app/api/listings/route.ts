import { NextResponse } from "next/server";
import { getDetailFields, getFacilities, getPricing } from "@/lib/data";
import { cleanDetails, ownerFields } from "@/lib/listings";
import { submitListing } from "@/lib/n8n";
import { verifyPayment } from "@/lib/paystack";
import { dealFee, type Pricing } from "@/lib/pricing";
import { genericError, logError } from "@/lib/errors";
import { allow, clientKey } from "@/lib/ratelimit";
import { REFUSED, cleanEmail, cleanPhone, cleanText, looksLikeInstructions } from "@/lib/sanitize";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_IMAGES, RENT_ONLY, emptyListing, onlyFacilities, parseNaira, validateListing, withTitle, type ListingInput } from "@/lib/validation";

const bad = (error: string, status = 400) => NextResponse.json({ success: false, data: null, error }, { status });
const BUCKET = "submissions";
/** Free-text fields: how long each may be, and whether line breaks are kept. */
const FREE_TEXT: Partial<Record<keyof ListingInput, [number, boolean]>> = {
  fullName: [80, false], address: [200, false], neighbourhood: [100, false], serviceCovers: [200, false],
  parking: [120, false], security: [120, false], inspection: [200, false], description: [2000, true],
};

/** Confirms the listing fee was paid and has not been used before. Returns an error response, or the folder for this submission's photos. */
async function paidFolder(reference: string, pricing: Pricing) {
  const payment = await verifyPayment(reference, pricing.listingFee);
  if (payment === "not-configured") return bad("This service is not configured yet.", 500);
  if (payment === "unreachable") return bad("We could not confirm your payment just now. Please try again.", 502);
  if (payment === "unpaid") return bad("We could not find a successful payment of the listing fee.", 402);
  const used = await supabaseAdmin().from("agreements").select("id").eq("payment_reference", reference).limit(1);
  if (used.error) return bad("We could not check your payment just now. Please try again.", 502);
  // A reference that already paid an invoice cannot be reused as a listing fee.
  const invoice = await supabaseAdmin().from("leads").select("id").eq("payment_reference", reference).limit(1);
  if (invoice.error) return bad("We could not check your payment just now. Please try again.", 502);
  if (invoice.data.length) return bad("This payment has already been used. Each property needs its own listing fee.", 409);
  if (used.data.length) return bad("This payment has already been used for a property. Each property needs its own listing fee.", 409);
  return `sub/${reference}`;
}

/**
 * Two steps, after the owner has paid the listing fee:
 * 1. `{ step: "prepare", paymentReference, count }` returns one-time upload links, so photos go straight to storage;
 * 2. the form itself: checked, then sent to the n8n Listing API, which stores it and notifies the team.
 */
export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    return bad(genericError(logError("api/listings", e)), 500);
  }
}

async function handle(req: Request) {
  if (!(await allow(`listing-ip:${await clientKey()}`, 60, 3600))) return bad("Too many attempts. Please wait a while and try again.", 429);
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return bad("Invalid request.");
  const reference = typeof raw.paymentReference === "string" ? raw.paymentReference.trim() : "";
  const pricing = await getPricing();
  const folder = await paidFolder(reference, pricing);
  if (typeof folder !== "string") return folder;
  const storage = supabaseAdmin().storage.from(BUCKET);

  if (raw.step === "prepare") {
    const count = Number(raw.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGES) return bad(`Add between 1 and ${MAX_IMAGES} photos.`);
    const uploads: { path: string; token: string }[] = [];
    for (let i = 0; i < count; i++) {
      const path = `${folder}/${i}.jpg`;
      const { data, error } = await storage.createSignedUploadUrl(path, { upsert: true });
      if (error || !data) return bad("We could not prepare the photo upload. Please try again.", 502);
      uploads.push({ path, token: data.token });
    }
    return NextResponse.json({ success: true, data: { uploads }, error: null });
  }

  // Only known fields, as trimmed strings.
  const listing = { ...emptyListing } as ListingInput;
  for (const key of Object.keys(emptyListing) as (keyof ListingInput)[]) {
    const v = raw[key];
    const free = FREE_TEXT[key];
    listing[key] =
      key === "email" ? cleanEmail(v) : key === "phone" ? cleanPhone(v) : free ? cleanText(v, free[0], free[1]) : typeof v === "string" ? v.trim().slice(0, 300) : "";
  }
  if ((Object.keys(FREE_TEXT) as (keyof ListingInput)[]).some((k) => looksLikeInstructions(listing[k]))) return bad(REFUSED);
  if (listing.purpose !== "Rent") for (const key of RENT_ONLY) listing[key] = "";
  listing.facilities = onlyFacilities(listing.facilities, await getFacilities());

  // The photos are whatever was uploaded into this payment's folder.
  const files = await storage.list(folder, { limit: MAX_IMAGES + 5, sortBy: { column: "name", order: "asc" } });
  if (files.error) return bad("We could not read your photos. Please try again.", 502);
  const photos = files.data
    .filter((f) => /^\d+\.jpg$/.test(f.name) && String(f.metadata?.mimetype ?? "").startsWith("image/"))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name))
    .map((f) => `${folder}/${f.name}`);

  const errors = validateListing(listing, { count: photos.length, bytes: 0 });
  if (Object.keys(errors).length > 0) return bad(Object.values(errors).join(" "));

  // From here on the owner is "Mr Bello", exactly as the emails and the dashboard will greet them.
  listing.fullName = withTitle(listing.title, listing.fullName);

  const rent = listing.purpose === "Rent";
  const fee = dealFee(pricing, rent ? "Rent" : "Sell");
  const { status, body } = await submitListing({
    purpose: listing.purpose,
    relationship: rent ? "Landlord (confirmed)" : listing.relationship,
    fullName: listing.fullName,
    email: listing.email.toLowerCase(),
    phone: listing.phone,
    propertyType: listing.propertyType,
    address: listing.address,
    neighbourhood: listing.neighbourhood,
    bedrooms: listing.bedrooms,
    askingAmount: parseNaira(listing.askingAmount),
    legalFee: parseNaira(listing.legalFee),
    cautionPct: Number(listing.cautionRate.replace("%", "")) || 0,
    serviceCharge: parseNaira(listing.serviceCharge),
    serviceCovers: listing.serviceCovers,
    facilities: listing.facilities.split(",").filter(Boolean),
    parking: listing.parking,
    security: listing.security,
    inspection: listing.inspection,
    videoLink: listing.videoLink,
    description: listing.description,
    details: cleanDetails(ownerFields(await getDetailFields(), listing.purpose), raw.details),
    photos,
    // The terms the owner accepted, as they stood when the property was submitted.
    paymentReference: reference,
    agreementVersion: pricing.agreementVersion,
    listingFee: pricing.listingFee,
    feePct: rent ? pricing.agencyFeePct : pricing.saleCommissionPct,
    feeDue: fee.due,
    protectionMonths: pricing.protectionMonths,
  });
  return NextResponse.json(body, { status });
}

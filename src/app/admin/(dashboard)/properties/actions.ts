"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDetailFields, getFacilities, getPricing } from "@/lib/data";
import { ASK_OWNER, DETAIL_TYPES, cleanDetails, type DetailField } from "@/lib/listings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { dealFee } from "@/lib/pricing";
import { CAUTION_RATES, PROPERTY_TYPES, isEmail, isPhone, parseNaira } from "@/lib/validation";
import { withId } from "@/lib/errors";

type Result = { error: string | null };
const CATEGORIES = ["Rent", "Buy", "Invest"];

/** Deletes photo files from storage. Team members can upload but not list files, so this runs with the secret key. */
async function removeFiles(paths: string[]) {
  const stored = paths.filter((p) => !p.startsWith("/")); // paths starting with "/" ship with the site
  if (stored.length) await supabaseAdmin().storage.from("listings").remove(stored);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/properties");
}

/** Adds a property, or saves changes to one. Photos are already in storage; `photos` lists their paths in order. */
export async function saveListing(form: FormData): Promise<Result> {
  await requireUser("drafts");
  const db = await supabaseServer();
  const text = (k: string) => String(form.get(k) ?? "").trim().slice(0, 4000);
  const count = (k: string) => (text(k) ? Math.min(Number(text(k).replace(/\D/g, "")) || 0, 99) : null);
  const id = text("dbId");
  const category = text("category");
  const price = parseNaira(text("price"));
  const rent = category === "Rent";

  if (!CATEGORIES.includes(category)) return { error: "Choose where the property is shown." };
  if (!(PROPERTY_TYPES as readonly string[]).includes(text("propertyType"))) return { error: "Choose a property type." };
  if (!text("title") || !text("location")) return { error: "Enter a title and a location." };
  if (!price) return { error: rent ? "Enter the annual rent in naira." : "Enter the price in naira." };
  const caution = text("cautionRate");
  if (caution && !(CAUTION_RATES as readonly string[]).includes(caution)) return { error: "Choose a caution deposit from the list." };
  const video = text("video");
  if (video && !/^https:\/\/\S+\.\S+$/.test(video)) return { error: "The video link must start with https://" };

  let photos: string[] = [];
  let rawDetails: unknown = {};
  try {
    photos = (JSON.parse(text("photos") || "[]") as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 20);
    rawDetails = JSON.parse(text("details") || "{}");
  } catch {
    return { error: "Something went wrong reading the form. Reload the page and try again." };
  }
  if (photos.length === 0) return { error: "Add at least one photo." };

  const row = {
    category,
    property_type: text("propertyType"),
    title: text("title"),
    location: text("location"),
    price,
    beds: count("beds"),
    baths: count("baths"),
    size: text("size") || null,
    description: text("description"),
    details: cleanDetails(await getDetailFields(), rawDetails),
    // The charges only apply to rentals.
    agency_fee: rent ? parseNaira(text("agencyFee")) : 0,
    legal_fee: rent ? parseNaira(text("legalFee")) : 0,
    caution_pct: rent && caution ? Number(caution.replace("%", "")) : 0,
    service_charge: rent ? parseNaira(text("serviceCharge")) : 0,
    service_covers: rent ? text("serviceCovers") : "",
    // Facilities are saved by name, so a property keeps one even if it is later removed from the list.
    facilities: [...new Set(form.getAll("facilities").map((f) => String(f).trim()).filter((f) => f && f.length <= 40 && !f.includes(",")))].slice(0, 40),
    parking: text("parking"),
    security: text("security"),
    inspection: text("inspection"),
    video_url: video || null,
    verified: form.get("verified") === "on",
    published: form.get("published") === "on",
  };

  const saved = id
    ? await db.from("listings").update(row).eq("id", id).select("id").single()
    : await db.from("listings").insert(row).select("id").single();
  if (saved.error || !saved.data) {
    // The database refuses publishing or verifying from a role that is not allowed to.
    return { error: saved.error?.message.includes("cannot publish") ? "Your role can save drafts but cannot publish or verify a property." : "The property could not be saved. Please try again." };
  }

  const listingId = saved.data.id as string;
  const before = await db.from("listing_images").select("path").eq("listing_id", listingId);
  await db.from("listing_images").delete().eq("listing_id", listingId);
  const put = await db.from("listing_images").insert(photos.map((path, position) => ({ listing_id: listingId, path, position })));
  if (put.error) return { error: withId("properties", put.error, "The property was saved but its photos were not. Open it and save again.") };
  // Photos that were removed in the editor are deleted from storage.
  await removeFiles((before.data ?? []).map((p) => p.path as string).filter((p) => !photos.includes(p)));

  refresh();
  return { error: null };
}

export async function deleteListing(id: string): Promise<Result> {
  await requireUser("publish");
  const db = await supabaseServer();
  const photos = await db.from("listing_images").select("path").eq("listing_id", id);
  const { error } = await db.from("listings").delete().eq("id", id);
  if (error) {
    return {
      error: error.code === "23503"
        ? "This property has leads linked to it, so it cannot be deleted. Take it off the website by unticking Published instead."
        : "The property could not be deleted. Please try again.",
    };
  }
  await removeFiles((photos.data ?? []).map((p) => p.path as string));
  refresh();
  return { error: null };
}

/** Creates a new additional detail that every property can then fill in. */
export async function addDetailField(field: DetailField): Promise<Result> {
  await requireUser("drafts");
  const id = String(field.id).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  const label = String(field.label).trim().slice(0, 80);
  const options = field.type === "Dropdown" ? (field.options ?? []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 30) : null;
  if (!id || !label || !(DETAIL_TYPES as readonly string[]).includes(field.type) || !(ASK_OWNER as readonly string[]).includes(field.askOwner))
    return { error: "That detail is not valid." };
  if (options && options.length < 2) return { error: "Enter at least two options." };
  const db = await supabaseServer();
  const { error } = await db.from("detail_fields").insert({ id, label, type: field.type, options, ask_owner: field.askOwner, position: Math.floor(Date.now() / 1000) });
  if (error) return { error: error.code === "23505" ? "A detail with that title already exists." : "The detail could not be added." };
  refresh();
  return { error: null };
}

/** Removes an additional detail from every property and from the List Property form. */
export async function removeDetailField(id: string): Promise<Result> {
  await requireUser("drafts");
  const db = await supabaseServer();
  const { error } = await db.from("detail_fields").delete().eq("id", id);
  if (error) return { error: withId("properties", error, "The detail could not be removed.") };
  refresh();
  return { error: null };
}

/** Adds a facility to the list offered in the forms and the property editor. */
export async function addFacility(name: string): Promise<Result> {
  await requireUser("drafts");
  const clean = String(name).replace(/\s+/g, " ").trim();
  if (!clean) return { error: "Enter a name for the facility." };
  if (clean.length > 40) return { error: "Keep the name to 40 characters or fewer." };
  if (clean.includes(",")) return { error: "The name cannot contain a comma." };
  const existing = await getFacilities();
  if (existing.some((f) => f.toLowerCase() === clean.toLowerCase())) return { error: "That facility is already in the list." };
  const db = await supabaseServer();
  const { error } = await db.from("facilities").insert({ name: clean, position: Math.floor(Date.now() / 1000) });
  if (error) return { error: error.code === "23505" ? "That facility is already in the list." : error.code === "42P01" ? "The facilities table is not set up yet. Run the latest SQL file in Supabase." : "The facility could not be added. Please try again." };
  refresh();
  return { error: null };
}

/** Removes a facility from the list. Properties that already have it keep it. */
export async function removeFacility(name: string): Promise<Result> {
  await requireUser("drafts");
  const db = await supabaseServer();
  const { error } = await db.from("facilities").delete().eq("name", String(name));
  if (error) return { error: withId("properties", error, "The facility could not be removed. Please try again.") };
  refresh();
  return { error: null };
}

const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_PROOF_BYTES = 4 * 1024 * 1024;

/**
 * Adds the owner to a property the team sourced itself, and records the owner's agreement.
 * The rate, due date, protection period and version always come from the company's own terms, never from the browser.
 * The database (`attach_owner`) does the work in one step and writes the history.
 */
export async function setListingOwner(form: FormData): Promise<Result> {
  const user = await requireUser("approve");
  const text = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const listingId = text("listingId", 40);
  const name = text("name", 120);
  const whatsapp = text("whatsapp", 30);
  const email = text("email", 200).toLowerCase();
  const acceptedOn = text("acceptedOn", 10);
  const note = text("proofNote", 300);
  const paid = text("feeMode", 10) !== "waived";
  const transferRef = text("transferRef", 80);

  if (!/^[0-9a-f-]{36}$/.test(listingId)) return { error: "That property could not be found." };
  if (!name) return { error: "Enter the owner's name." };
  if (!isPhone(whatsapp)) return { error: "Enter the owner's WhatsApp number (7 to 20 digits)." };
  if (!isEmail(email)) return { error: "Enter a valid email address for the owner." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(acceptedOn)) return { error: "Choose the date the owner agreed." };
  if (paid && !transferRef) return { error: "Enter the reference of the listing-fee payment, or choose that the fee is waived." };
  if (note.length < 3) return { error: "Say what the proof is, for example: signed paper agreement." };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm the owner agreed and you hold the proof." };

  const admin = supabaseAdmin();
  const { data: listing } = await admin.from("listings").select("category").eq("id", listingId).single();
  if (!listing) return { error: "That property could not be found." };
  const pricing = await getPricing();
  const fee = dealFee(pricing, listing.category);

  // The proof, if one was attached, goes in the private evidence bucket.
  let proofPath = "";
  const file = form.get("proof");
  if (file instanceof File && file.size > 0) {
    if (!PROOF_TYPES.includes(file.type)) return { error: "The proof must be a photo (JPG or PNG) or a PDF." };
    if (file.size > MAX_PROOF_BYTES) return { error: "The proof file is too large. Keep it under 4 MB." };
    proofPath = `agreements/${crypto.randomUUID()}.${file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]}`;
    const up = await admin.storage.from("evidence").upload(proofPath, file, { contentType: file.type });
    if (up.error) return { error: withId("properties", up.error, "The proof file could not be uploaded. Please try again.") };
  }

  const { error } = await admin.rpc("attach_owner", {
    p_listing: listingId,
    p_owner: { name, whatsapp, email },
    p_agreement: {
      version: pricing.agreementVersion,
      acceptedOn,
      listingFee: paid ? pricing.listingFee : 0,
      feePct: listing.category === "Rent" ? pricing.agencyFeePct : pricing.saleCommissionPct,
      feeDue: fee.due,
      protectionMonths: pricing.protectionMonths,
      paymentReference: paid ? transferRef : "",
      proofNote: note,
      proofPath,
    },
    p_actor: user.name,
  });
  if (error) {
    if (proofPath) await admin.storage.from("evidence").remove([proofPath]);
    return { error: error.code === "P0001" ? error.message : "The owner could not be saved. Please try again." };
  }
  revalidatePath("/admin", "layout");
  return { error: null };
}

/** Fixes a typo in an owner's name, WhatsApp number or email. Every property of that owner gets a history entry. */
export async function editOwnerContact(ownerId: string, name: string, whatsapp: string, email: string): Promise<Result> {
  const user = await requireUser("approve");
  if (!/^[0-9a-f-]{36}$/.test(ownerId)) return { error: "That owner could not be found." };
  if (!name.trim()) return { error: "Enter the owner's name." };
  if (!isPhone(whatsapp.trim())) return { error: "Enter the owner's WhatsApp number (7 to 20 digits)." };
  if (!isEmail(email.trim())) return { error: "Enter a valid email address for the owner." };
  const { error } = await supabaseAdmin().rpc("update_owner_contact", {
    p_owner: ownerId, p_name: name.trim().slice(0, 120), p_whatsapp: whatsapp.trim().slice(0, 30), p_email: email.trim().slice(0, 200), p_actor: user.name,
  });
  if (error) return { error: error.code === "P0001" ? error.message : withId("properties", error, "The details could not be saved. Please try again.") };
  revalidatePath("/admin", "layout");
  return { error: null };
}

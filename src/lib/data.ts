import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FACILITIES } from "./validation";
import { cache } from "react";
import { supabaseAdmin } from "./supabase/admin";
import { defaultPricing, type Pricing } from "./pricing";
import { mergeSiteContent, type SiteContent } from "./site-content";
import { detailFields as fallbackFields, photoUrl, sampleListings, type DetailField, type Listing } from "./listings";
import type { Lead } from "./leads";
import type { Submission } from "./submissions";
import type { Traffic } from "./track";
import { naira } from "./validation";
import { LEGAL_DEFAULTS } from "./legal-defaults";
import type { LegalPage, LegalSlug } from "./legal";

/** Reads what any visitor may read. No session, so pages using it can be cached. */
const publicDb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

const LISTING_COLUMNS = "*, listing_images(path, position)";
/** What the team sees: also the owner and their agreement, which visitors never can. */
const ADMIN_LISTING_COLUMNS =
  "*, listing_images(path, position), owner:owners(code, name, whatsapp, email), agreement:agreements(version, accepted_at, accepted_via, recorded_by, listing_fee, fee_pct, fee_due, protection_months, payment_reference, proof_note, proof_path)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a database row
function toListing(r: any): Listing {
  const photos = [...(r.listing_images ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: r.code,
    dbId: r.id,
    // Real properties get a code like P-0007 from the database; the loaded samples kept their own ids.
    sample: !/^P-\d+$/.test(r.code),
    published: r.published,
    category: r.category,
    propertyType: r.property_type,
    title: r.title,
    location: r.location,
    price: naira(r.price),
    beds: r.beds ?? undefined,
    baths: r.baths ?? undefined,
    size: r.size ?? undefined,
    description: r.description,
    details: r.details ?? {},
    costs:
      r.category === "Rent"
        ? { rent: r.price, agencyFee: r.agency_fee, legalFee: r.legal_fee, cautionPct: Number(r.caution_pct), serviceCharge: r.service_charge }
        : undefined,
    serviceCovers: r.service_covers || undefined,
    facilities: r.facilities ?? [],
    parking: r.parking || undefined,
    security: r.security || undefined,
    inspection: r.inspection || undefined,
    video: r.video_url ?? undefined,
    verified: r.verified,
    owner: r.owner ? { id: r.owner_id, ...r.owner } : undefined,
    agreement: r.agreement
      ? {
          version: r.agreement.version,
          acceptedAt: r.agreement.accepted_at,
          via: r.agreement.accepted_via ?? "online form",
          recordedBy: r.agreement.recorded_by ?? undefined,
          listingFee: r.agreement.listing_fee,
          feePct: Number(r.agreement.fee_pct),
          feeDue: r.agreement.fee_due,
          protectionMonths: r.agreement.protection_months,
          paymentRef: r.agreement.payment_reference,
          proofNote: r.agreement.proof_note ?? undefined,
          proofPath: r.agreement.proof_path ?? undefined,
        }
      : undefined,
    imagePaths: photos.map((p) => p.path),
    images: photos.map((p) => photoUrl(p.path)),
  };
}

/** The admin columns as they were before migration 0006 added the agreement proof columns. */
const ADMIN_LISTING_COLUMNS_BEFORE_0006 = ADMIN_LISTING_COLUMNS.replace("accepted_via, recorded_by, ", "").replace(", proof_note, proof_path", "");

async function listingsFrom(db: SupabaseClient, onlyPublished: boolean, withOwner = false) {
  const load = (columns: string) => {
    const q = db.from("listings").select(columns).order("created_at", { ascending: false });
    return onlyPublished ? q.eq("published", true) : q;
  };
  let { data, error } = await load(withOwner ? ADMIN_LISTING_COLUMNS : LISTING_COLUMNS);
  // The newest database file may not have been run yet: carry on without its columns instead of breaking the page.
  if (error?.code === "42703" && withOwner) ({ data, error } = await load(ADMIN_LISTING_COLUMNS_BEFORE_0006));
  if (error) throw new Error(error.message);
  return (data ?? []).map(toListing);
}

/** Properties shown on the website. Falls back to the built-in samples if the database cannot be reached. Read once per page. */
export const getPublishedListings = cache(async (): Promise<Listing[]> => {
  try {
    return await listingsFrom(publicDb(), true);
  } catch (e) {
    console.error("Could not load properties from the database; showing the built-in samples.", e);
    return sampleListings;
  }
});

/** Every property, drafts included, with its owner and agreement, for a signed-in team member. Proof files come back as one-hour links. */
export async function getAllListings(db: SupabaseClient): Promise<Listing[]> {
  const list = await listingsFrom(db, false, true);
  const paths = list.flatMap((l) => (l.agreement?.proofPath ? [l.agreement.proofPath] : []));
  if (paths.length) {
    const signed = await db.storage.from("evidence").createSignedUrls(paths, 3600);
    const link = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
    for (const l of list) if (l.agreement?.proofPath) l.agreement.proofUrl = link.get(l.agreement.proofPath) ?? undefined;
  }
  return list;
}

/** The additional details the admin has defined. */
export async function getDetailFields(): Promise<DetailField[]> {
  const { data, error } = await publicDb().from("detail_fields").select("*").order("position");
  if (error) {
    console.error("Could not load detail fields from the database; using the built-in ones.", error.message);
    return fallbackFields;
  }
  return data.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options ?? undefined, askOwner: f.ask_owner }));
}

const yesNo = (v: boolean | null) => (v === null ? undefined : v ? "Yes" : "No");
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a database row
function toLead(r: any): Lead {
  return {
    dbId: r.id,
    id: r.code,
    kind: r.kind,
    enquiryType: r.enquiry_type,
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone, emailVerified: !!r.email_verified_at },
    listing: r.listing ? { dbId: r.listing.id, code: r.listing.code, title: r.listing.title, location: r.listing.location } : undefined,
    owner: r.owner ?? undefined,
    source: r.source,
    introducedAt: r.introduced_at,
    releasedAt: r.released_at ?? undefined,
    status: r.status,
    customerAck: r.customer_ack_at ?? undefined,
    ownerAck: r.owner_ack_at ?? undefined,
    agreement: r.agreement_id
      ? {
          version: r.agreement_version,
          acceptedAt: r.agreement?.accepted_at,
          listingFee: r.agreement?.listing_fee,
          feePct: Number(r.fee_pct),
          feeDue: r.fee_due,
          protectionMonths: r.protection_months,
        }
      : undefined,
    followUps: {
      customerInspected: yesNo(r.customer_inspected),
      ownerInspected: yesNo(r.owner_inspected),
      customerCompleted: yesNo(r.customer_completed),
      ownerCompleted: yesNo(r.owner_completed),
    },
    completion: r.final_price
      ? { date: r.completion_date, price: r.final_price, evidence: r.evidence_note, verified: !!r.completion_verified_at }
      : undefined,
    feeAmount: r.fee_amount ?? undefined,
    invoice: r.invoice_status,
    receipt: r.receipt_code ?? undefined,
    suspect: r.suspect_reason ?? undefined,
    inspection: { date: r.inspection_date ?? undefined, slot: r.inspection_slot ?? undefined, confirmedFor: r.inspection_confirmed_for ?? undefined, confirmedBy: r.inspection_confirmed_by ?? undefined },
    conflict: r.conflict,
    followUpCount: r.follow_up_count ?? 0,
    propertyType: r.property_type,
    location: r.location,
    budget: r.budget,
    moveIn: r.move_in_date ? day.format(new Date(`${r.move_in_date}T00:00:00Z`)) : "Not given",
    facilities: r.facilities ?? [],
    assistance: r.assistance,
    note: r.note,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a database row
    history: (r.audit ?? []).map((a: any) => ({ at: a.at, by: a.actor, what: a.detail ? `${a.action}: ${a.detail}` : a.action })),
  };
}

/** Every lead with its property, owner and history, newest first, for a signed-in team member. */
export async function getLeads(db: SupabaseClient): Promise<Lead[]> {
  const { data, error } = await db
    .from("leads")
    .select(
      "*, listing:listings(id, code, title, location), owner:owners(code, name, email, whatsapp), agreement:agreements(accepted_at, listing_fee), audit(id, at, actor, action, detail)",
    )
    .order("introduced_at", { ascending: false })
    .order("id", { referencedTable: "audit" });
  if (error) throw new Error(error.message);
  return data.map(toLead);
}

/** Leads still waiting for approval, for the bell and the menu badge. */
export async function getWaitingLeads(db: SupabaseClient) {
  const { data } = await db
    .from("leads")
    .select("code, customer_name, enquiry_type, property_type, location")
    .eq("status", "New Enquiry")
    .order("introduced_at", { ascending: false });
  return (data ?? []).map((l) => ({ id: l.code as string, name: l.customer_name as string, type: l.enquiry_type as string, propertyType: l.property_type as string, location: l.location as string }));
}

/** Owner submissions, newest first, for a signed-in team member. Photos come back as one-hour links. */
export async function getSubmissions(db: SupabaseClient): Promise<Submission[]> {
  const base = "*, owner:owners(code, name, email, whatsapp), agreement:agreements(version, accepted_at, listing_fee, fee_pct, fee_due, protection_months, payment_reference), submission_images(path, position)";
  const refundCols = "refunds(status, method, amount, created_at, created_by, completed_at, failure, note)";
  // The newest database changes may not have been run yet (migrations 0012 and 0013): fall back to what exists, so the page always opens.
  const tries = [
    `${base}, listings(code, published, owner_notified_at), ${refundCols}`,
    `${base}, listings(code, published, owner_notified_at)`,
    `${base}, listings(code, published), ${refundCols}`,
    `${base}, listings(code, published)`,
  ];
  let data: unknown[] | null = null;
  let error: { message: string } | null = null;
  for (const columns of tries) {
    ({ data, error } = await db.from("submissions").select(columns).order("created_at", { ascending: false }));
    if (!error) break;
  }
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- database rows
  const rows = data as any[];
  const paths = rows.flatMap((r) => r.submission_images.map((i: { path: string }) => i.path));
  const signed = paths.length ? await db.storage.from("submissions").createSignedUrls(paths, 3600) : { data: [] };
  const link = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
  return rows.map((r) => ({
    dbId: r.id,
    id: r.code,
    purpose: r.purpose,
    relationship: r.relationship,
    owner: { code: r.owner.code, name: r.owner.name, phone: r.owner.whatsapp, email: r.owner.email },
    propertyType: r.property_type,
    address: r.address,
    neighbourhood: r.neighbourhood,
    bedrooms: r.bedrooms ?? undefined,
    amount: r.asking_amount,
    description: r.description,
    photos: [...r.submission_images]
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((i: { path: string }) => link.get(i.path))
      .filter((u): u is string => !!u),
    costs:
      r.purpose === "Rent"
        ? { rent: r.asking_amount, agencyFee: 0, legalFee: r.legal_fee, cautionPct: Number(r.caution_pct), serviceCharge: r.service_charge }
        : undefined,
    serviceCovers: r.service_covers,
    facilities: r.facilities ?? [],
    parking: r.parking,
    security: r.security,
    inspection: r.inspection,
    video: r.video_url ?? undefined,
    details: r.details ?? {},
    agreement: {
      version: r.agreement.version,
      acceptedAt: r.agreement.accepted_at,
      listingFee: r.agreement.listing_fee,
      feePct: Number(r.agreement.fee_pct),
      feeDue: r.agreement.fee_due,
      protectionMonths: r.agreement.protection_months,
      paymentRef: r.agreement.payment_reference,
    },
    rejection: r.rejected_reason ? { reasonId: r.rejected_reason, note: r.rejected_note ?? undefined, refundDecision: r.refund_decision ?? null } : undefined,
    refund: (() => {
      // A fee can have several attempts (failed ones, then one that counts). Show the one that counts, else the latest failure.
      const rows = [...(r.refunds ?? [])].sort((a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at));
      const x = rows.find((v: { status: string }) => v.status !== "Failed") ?? rows[0];
      return x ? { status: x.status, method: x.method, amount: Number(x.amount), at: x.created_at, by: x.created_by, completedAt: x.completed_at ?? undefined, failure: x.failure ?? undefined, note: x.note || undefined } : undefined;
    })(),
    listingCode: r.listings?.[0]?.code,
    listingPublished: !!r.listings?.[0]?.published,
    ownerEmailedAt: r.listings?.[0]?.owner_notified_at ?? undefined,
    status: r.status,
    unread: r.unread,
    receivedAt: r.created_at,
  }));
}

/** Submissions nobody has opened yet, for the bell and the menu badge. Empty for roles that cannot see submissions. */
export async function getUnreadSubmissions(db: SupabaseClient) {
  const { data } = await db
    .from("submissions")
    .select("code, purpose, property_type, neighbourhood, created_at")
    .eq("unread", true)
    .order("created_at", { ascending: false });
  return (data ?? []).map((s) => ({ id: s.code as string, purpose: s.purpose as string, propertyType: s.property_type as string, place: s.neighbourhood as string, receivedAt: s.created_at as string }));
}

/** The facilities offered in the forms and the property editor, in order. Falls back to the built-in list. */
export async function getFacilities(): Promise<string[]> {
  const { data, error } = await publicDb().from("facilities").select("name").order("position");
  if (error || !data.length) {
    if (error) console.error("Could not load facilities from the database; using the built-in ones.", error.message);
    return [...FACILITIES];
  }
  return data.map((f) => f.name as string);
}

/** The company details and wording, with the built-in text wherever nothing has been saved. Read once per page. */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const { data, error } = await publicDb().from("site_content").select("key, value");
  if (error) console.error("Could not load the website wording from the database; using the built-in text.", error.message);
  return mergeSiteContent(data ?? []);
});

/** The fees, from the one-row pricing table. Falls back to the starting values. */
export const getPricing = cache(async (): Promise<Pricing> => {
  const { data, error } = await publicDb().from("pricing").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    if (error) console.error("Could not load the fees from the database; using the starting values.", error.message);
    return defaultPricing;
  }
  return {
    listingFee: Number(data.listing_fee),
    agencyFeePct: Number(data.agency_fee_pct),
    saleCommissionPct: Number(data.sale_commission_pct),
    tenantAssistFee: data.tenant_assist_fee === null ? null : Number(data.tenant_assist_fee),
    protectionMonths: data.protection_months,
    agreementVersion: data.agreement_version,
  };
});

/** Visit figures for each period, from the database function `traffic_summary` (only for people who may see traffic). */
export async function getTraffic(db: SupabaseClient, ranges: number[]): Promise<Record<number, Traffic>> {
  const out: Record<number, Traffic> = {};
  await Promise.all(
    ranges.map(async (days) => {
      const { data, error } = await db.rpc("traffic_summary", { p_days: days });
      if (error) throw new Error(error.message);
      out[days] = data as Traffic;
    }),
  );
  return out;
}

/** The latest recorded actions on leads, newest first, for the overview. */
export async function getRecentActivity(db: SupabaseClient, limit = 6) {
  const { data } = await db.from("audit").select("at, actor, action, lead:leads(code)").order("at", { ascending: false }).limit(limit);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined rows
  return (data ?? []).map((a: any) => ({ at: a.at as string, actor: a.actor as string, action: a.action as string, lead: (a.lead?.code ?? "") as string }));
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  /** "Active", "Invited" (has never signed in) or "Off". */
  status: "Active" | "Invited" | "Off";
  lastSignIn?: string;
}
export interface RoleRow {
  name: string;
  locked: boolean;
  can: string[];
}

/** The team and the roles, for someone who may manage the team. Last sign-in comes from the sign-in system, which only the server may read. */
export async function getTeam(db: SupabaseClient): Promise<{ members: TeamMember[]; roles: RoleRow[] }> {
  const [profiles, roles, perms, users] = await Promise.all([
    db.from("profiles").select("id, email, name, role, active, created_at").order("created_at"),
    db.from("roles").select("name, locked").order("name"),
    db.from("role_permissions").select("role, permission"),
    supabaseAdmin().auth.admin.listUsers({ perPage: 200 }),
  ]);
  const seen = new Map((users.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? undefined]));
  return {
    members: (profiles.data ?? []).map((p) => ({
      id: p.id,
      name: p.name || p.email.split("@")[0],
      email: p.email,
      role: p.role,
      lastSignIn: seen.get(p.id),
      status: !p.active ? "Off" : seen.get(p.id) ? "Active" : "Invited",
    })),
    roles: (roles.data ?? []).map((r) => ({
      name: r.name,
      locked: r.locked,
      can: (perms.data ?? []).filter((x) => x.role === r.name).map((x) => x.permission as string),
    })),
  };
}

/** A legal page: what was saved in the dashboard, or the starter text if nothing has been saved yet. */
export const getLegalPage = cache(async (slug: LegalSlug): Promise<LegalPage> => {
  const fallback = LEGAL_DEFAULTS[slug];
  const { data, error } = await publicDb().from("legal_pages").select("title, body, version, updated_at, updated_by").eq("slug", slug).maybeSingle();
  if (error) console.error("Could not load a legal page from the database; using the starter text.", error.message);
  return data
    ? { slug, title: data.title, body: data.body, version: data.version, updatedAt: data.updated_at, updatedBy: data.updated_by }
    : { slug, ...fallback, version: 0, updatedAt: null, updatedBy: "" };
});

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CONTENT_FIELDS, defaultValues } from "@/lib/site-content";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { withId } from "@/lib/errors";

type Result = { error: string | null };

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

/**
 * Saves the website wording. A value that matches the built-in text is not stored, so typing the original
 * wording back (or clearing the box) returns that piece to its default.
 */
export async function saveContent(form: FormData): Promise<Result> {
  await requireUser("content");
  const defaults = defaultValues();
  const rows: { key: string; value: string }[] = [];
  const reset: string[] = [];

  for (const f of CONTENT_FIELDS) {
    const raw = form.get(f.key);
    if (typeof raw !== "string") continue;
    const value = raw.replace(/\r\n/g, "\n").trim();
    if (value.length > (f.long ? 1500 : 200)) return { error: `"${f.label}" is too long.` };
    if (f.key === "name" && !value) return { error: "The company name cannot be empty." };
    if (f.key === "whatsapp" && value && !/^\d{8,15}$/.test(value)) return { error: "The WhatsApp number must be digits only, with the country code, for example 2348012345678." };
    // The footer follows the company name until someone writes it out, so the name-based line counts as "not changed".
    const unchanged = f.key === "footerLine" ? value === `${String(form.get("name") ?? defaults.name).trim() || defaults.name}. Lagos, Nigeria.` : value === defaults[f.key];
    if (!value || unchanged) reset.push(f.key);
    else rows.push({ key: f.key, value });
  }

  const db = await supabaseServer();
  if (rows.length) {
    const { error } = await db.from("site_content").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "key" });
    if (error) return { error: withId("content", error, "The changes could not be saved. Please try again.") };
  }
  if (reset.length) {
    const { error } = await db.from("site_content").delete().in("key", reset);
    if (error) return { error: withId("content", error, "The changes could not be saved. Please try again.") };
  }
  refresh();
  return { error: null };
}

/** Replaces the photo at the top of the page. The old uploaded one is removed from storage. */
export async function saveHeroImage(form: FormData): Promise<Result> {
  await requireUser("content");
  const file = form.get("hero");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (!file.type.startsWith("image/")) return { error: "The file must be a photo." };
  if (file.size > 4 * 1024 * 1024) return { error: "The photo is too large. Keep it under 4 MB." };

  const admin = supabaseAdmin();
  const path = `site/hero-${crypto.randomUUID()}.jpg`;
  const up = await admin.storage.from("listings").upload(path, file, { contentType: "image/jpeg" });
  if (up.error) return { error: withId("content", up.error, "The photo could not be uploaded. Please try again.") };

  const { data: old } = await admin.from("site_content").select("value").eq("key", "heroImage").maybeSingle();
  const { error } = await admin.from("site_content").upsert({ key: "heroImage", value: path, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    await admin.storage.from("listings").remove([path]);
    return { error: "The photo could not be saved. Please try again." };
  }
  if (old?.value?.startsWith("site/")) await admin.storage.from("listings").remove([old.value]);
  refresh();
  return { error: null };
}

/** Puts back the photo that came with the website. */
export async function resetHeroImage(): Promise<Result> {
  await requireUser("content");
  const admin = supabaseAdmin();
  const { data: old } = await admin.from("site_content").select("value").eq("key", "heroImage").maybeSingle();
  await admin.from("site_content").delete().eq("key", "heroImage");
  if (old?.value?.startsWith("site/")) await admin.storage.from("listings").remove([old.value]);
  refresh();
  return { error: null };
}

/** Saves the fees. Only the Owner can. Owners who already accepted keep the terms they accepted; the database starts a new agreement version. */
export async function saveFees(form: FormData): Promise<Result> {
  await requireUser("team");
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(/[^\d.]/g, ""));
  const listingFee = Math.round(num("listingFee"));
  const agencyFeePct = num("agencyFeePct");
  const saleCommissionPct = num("saleCommissionPct");
  const months = Math.round(num("protectionMonths"));
  const assistRaw = String(form.get("tenantAssistFee") ?? "").trim();
  const assist = assistRaw === "" ? null : Math.round(num("tenantAssistFee"));

  if (!Number.isFinite(listingFee) || listingFee < 0 || listingFee > 10_000_000) return { error: "The listing fee must be between ₦0 and ₦10,000,000." };
  if (!(agencyFeePct > 0 && agencyFeePct <= 50)) return { error: "The agency fee must be a percentage above 0 and up to 50." };
  if (!(saleCommissionPct > 0 && saleCommissionPct <= 50)) return { error: "The sale commission must be a percentage above 0 and up to 50." };
  if (!(months >= 1 && months <= 60)) return { error: "The protection period must be between 1 and 60 months." };
  if (assist !== null && (!Number.isFinite(assist) || assist < 0 || assist > 10_000_000)) return { error: "The tenant assistance fee must be between ₦0 and ₦10,000,000, or empty." };

  const db = await supabaseServer();
  const { data, error } = await db
    .from("pricing")
    .update({ listing_fee: listingFee, agency_fee_pct: agencyFeePct, sale_commission_pct: saleCommissionPct, tenant_assist_fee: assist, protection_months: months })
    .eq("id", 1)
    .select("id");
  if (error || !data?.length) return { error: withId("content", error, "The fees could not be saved. Only the Owner can change them.") };
  refresh();
  return { error: null };
}

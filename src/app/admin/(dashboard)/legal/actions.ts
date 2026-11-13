"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withId } from "@/lib/errors";
import { isLegalSlug } from "@/lib/legal";
import { cleanText } from "@/lib/sanitize";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { error: string | null };

const refresh = (slug: string) => {
  revalidatePath(`/legal/${slug}`);
  revalidatePath("/admin/legal");
};

/** Saves a legal page. The database stamps the version, the person and the time, and keeps every saved version for good. */
export async function saveLegal(slug: string, title: string, body: string): Promise<Result> {
  await requireUser("content");
  if (!isLegalSlug(slug)) return { error: "That page could not be found." };
  title = cleanText(title, 120);
  body = cleanText(body, 60000, true);
  if (title.length < 2) return { error: "Enter a title." };
  if (body.length < 20) return { error: "The page text is too short." };
  const { error } = await (await supabaseServer()).from("legal_pages").upsert({ slug, title, body }, { onConflict: "slug" });
  if (error) return { error: withId("legal.save", error, "The page could not be saved. Please try again.") };
  refresh(slug);
  return { error: null };
}

/** Goes back to the starter text. The versions already saved stay in the history. */
export async function restoreStarter(slug: string): Promise<Result> {
  await requireUser("content");
  if (!isLegalSlug(slug)) return { error: "That page could not be found." };
  const { error } = await (await supabaseServer()).from("legal_pages").delete().eq("slug", slug);
  if (error) return { error: withId("legal.restore", error, "The starter text could not be restored. Please try again.") };
  refresh(slug);
  return { error: null };
}

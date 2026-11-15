"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withId } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Marks an error as fixed (or open again). Allowed for anyone who may see the log. The entry itself is never edited. */
export async function setErrorFixed(id: string, fixed: boolean): Promise<{ error: string | null }> {
  const user = await requireUser("errors");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "That error could not be found." };
  const { error } = await supabaseAdmin()
    .from("error_log")
    .update(fixed ? { resolved_at: new Date().toISOString(), resolved_by: user.name } : { resolved_at: null, resolved_by: null })
    .eq("id", id);
  if (error) return { error: withId("errors.fixed", error, "That could not be saved. Please try again.") };
  revalidatePath("/admin", "layout");
  return { error: null };
}

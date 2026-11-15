"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { allow } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { genericError, logError, withId } from "@/lib/errors";

/**
 * For the Owner only: makes the site log a harmless error and shows its ID, so the Owner can search for that ID in the
 * host's logs and confirm that problems can be traced. Nothing is stored, sent or changed.
 */
export async function stageTestError(): Promise<{ error: string | null; message?: string }> {
  const user = await requireUser();
  if (user.role !== "Owner") return { error: "Only the Owner can do this." };
  if (!(await allow(`test-error:${user.id}`, 10, 3600))) return { error: "That was done a few times already. Try again in an hour." };
  const id = logError("admin.test-error", new Error("Test error staged on purpose by the Owner. Nothing is wrong."), { staged: true });
  return { error: null, message: genericError(id) };
}

/** Sets the signed-in person's own display name. Nobody can use this to change anyone else's. */
export async function setMyName(name: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  name = name.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { error: "Enter your name (at least 2 characters)." };
  if (name.length > 80) return { error: "Use 80 characters or fewer." };
  const { error } = await supabaseAdmin().from("profiles").update({ name }).eq("id", user.id);
  if (error) return { error: withId("account", error, "Your name could not be saved. Please try again.") };
  revalidatePath("/admin", "layout");
  return { error: null };
}

/**
 * Changes the password after checking the current one, then signs the person out on every device
 * (every refresh token for this account is revoked on the server), this one included.
 */
export async function changeMyPassword(current: string, next: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (next.length < 10) return { error: "Use a new password of at least 10 characters." };
  if (next === current) return { error: "The new password must be different from the current one." };
  if (!(await allow(`password-change:${user.id}`, 5, 900))) return { error: "Too many tries. Please wait 15 minutes and try again." };

  // The current password is checked on a separate client, so it does not touch this browser's session.
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return { error: "The current password is not correct." };
  await check.auth.signOut({ scope: "local" });

  const db = await supabaseServer();
  const { error } = await db.auth.updateUser({ password: next });
  if (error) return { error: /weak|pwned|common|easy/i.test(error.message) ? "Use a longer, less common password." : withId("account.password", error, "The password could not be changed. Please try again.") };

  // Ends every session of this account on the server, so a stolen or forgotten device is signed out too.
  const { error: out } = await db.auth.signOut({ scope: "global" });
  if (out) logError("account.password.signout", out, { userId: user.id });
  redirect("/admin/login?changed=1");
}

"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export interface JoinState {
  error: string;
}

/** Accepts an invitation: the emailed link is checked only now, so an email scanner opening it first cannot use it up. */
export async function acceptInvite(_: JoinState, form: FormData): Promise<JoinState> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") === "magiclink" ? "magiclink" : "invite";
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords do not match." };
  if (!/^[\w-]{10,200}$/.test(tokenHash)) return { error: "This invitation link is not valid. Ask for a new one." };

  const db = await supabaseServer();
  const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return { error: "This invitation link has expired or was already used. Ask the Owner to send it again." };
  const { error: set } = await db.auth.updateUser({ password });
  if (set) return { error: "The password could not be saved. Use a longer, less common password." };
  redirect("/admin");
}

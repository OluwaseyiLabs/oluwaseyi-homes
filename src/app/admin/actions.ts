"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export interface SignInState {
  error: string;
  /** Sent back so the email stays filled in after a failed attempt. */
  email: string;
}

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { email, error: "Enter your email and password." };
  const db = await supabaseServer();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { email, error: "That email and password do not match an account." };
  const { data: profile } = await db.from("profiles").select("active").eq("id", data.user.id).single();
  if (!profile?.active) {
    await db.auth.signOut({ scope: "local" });
    return { email, error: "This account has been switched off. Ask the owner to switch it back on." };
  }
  redirect("/admin");
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}

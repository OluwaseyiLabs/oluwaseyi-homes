import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";

export interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

/** The signed-in, active team member, or null. Checked with Supabase on every request, not read from the cookie alone. */
export const getUser = cache(async (): Promise<TeamUser | null> => {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await db.from("profiles").select("email, name, role, active").eq("id", data.user.id).single();
  if (!profile?.active) return null;
  const { data: perms } = await db.from("role_permissions").select("permission").eq("role", profile.role);
  return {
    id: data.user.id,
    email: profile.email,
    name: profile.name || profile.email.split("@")[0],
    role: profile.role,
    permissions: (perms ?? []).map((p) => p.permission),
  };
});

/** For dashboard pages and actions: sends visitors to the login page, and people without the permission back to the dashboard. */
export async function requireUser(permission?: string) {
  const user = await getUser();
  if (!user) {
    // Signed in but switched off: end the session. Not signed in at all: ask for the password.
    const { data } = await (await supabaseServer()).auth.getUser();
    redirect(data.user ? "/admin/off" : "/admin/login");
  }
  if (permission && !user.permissions.includes(permission)) redirect("/admin");
  return user;
}

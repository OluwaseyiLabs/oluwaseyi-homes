"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSiteContent } from "@/lib/data";
import { sendEmail } from "@/lib/n8n";
import { siteUrl } from "@/lib/party";
import { BUILT_IN_ROLES, permissionList } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isEmail } from "@/lib/validation";
import { withId } from "@/lib/errors";

type Result = { error: string | null };
const done = (): Result => {
  revalidatePath("/admin", "layout");
  return { error: null };
};
const isId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
/** The database refuses what is not allowed and says why in plain words. */
const refused = (e: { code?: string; message: string }, fallback: string) => (e.code === "P0001" ? e.message : withId("team", e, fallback));

async function inviteLink(email: string, role: string, name: string, kind: "invite" | "magiclink") {
  const admin = supabaseAdmin();
  const { data, error } =
    kind === "invite"
      ? await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { role, name } } })
      : await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) return { error: error?.message ?? "No link was made.", url: "" };
  return { error: null, url: `${await siteUrl()}/admin/join?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${kind === "invite" ? "invite" : "magiclink"}` };
}

async function emailInvite(to: string, inviter: string, role: string, url: string): Promise<Result> {
  const { site } = await getSiteContent();
  const sent = await sendEmail({
    to,
    subject: `You are invited to the ${site.name} dashboard`,
    heading: "You are invited",
    paragraphs: [`${inviter} has invited you to the ${site.name} dashboard as ${role}.`, "Open the link to choose your password and sign in."],
    button: { label: "Accept the invitation", url },
    footnote: "The link is only for you and works once. If it has expired, ask for a new invitation.",
  });
  return sent.body.success ? { error: null } : { error: "The account is made, but the invitation email could not be sent. Use “Send invitation again”." };
}

export async function inviteMember(email: string, name: string, role: string): Promise<Result> {
  const user = await requireUser("team");
  email = email.trim().toLowerCase();
  name = name.trim().slice(0, 80);
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (!name) return { error: "Enter the person's name." };
  const db = await supabaseServer();
  const { data: r } = await db.from("roles").select("locked").eq("name", role).maybeSingle();
  if (!r || r.locked) return { error: "Choose a role from the list." };

  const link = await inviteLink(email, role, name, "invite");
  if (link.error) return { error: /already|registered|exists/i.test(link.error) ? "That email already has an account." : withId("team.invite", link.error, "The invitation could not be created. Please try again.") };
  const sent = await emailInvite(email, user.name, role, link.url);
  revalidatePath("/admin", "layout");
  return sent;
}

/** A new link for someone who has not signed in yet. */
export async function resendInvite(memberId: string): Promise<Result> {
  const user = await requireUser("team");
  if (!isId(memberId)) return { error: "That person could not be found." };
  const db = await supabaseServer();
  const { data: p } = await db.from("profiles").select("email, role").eq("id", memberId).single();
  if (!p) return { error: "That person could not be found." };
  const link = await inviteLink(p.email, p.role, "", "magiclink");
  if (link.error) return { error: withId("team", link.error, "A new link could not be created. Please try again.") };
  return emailInvite(p.email, user.name, p.role, link.url);
}

export async function setMemberRole(memberId: string, role: string): Promise<Result> {
  await requireUser("team");
  if (!isId(memberId)) return { error: "That person could not be found." };
  const db = await supabaseServer();
  const { data: r } = await db.from("roles").select("locked").eq("name", role).maybeSingle();
  if (!r || r.locked) return { error: "Choose a role from the list." };
  const { error } = await db.from("profiles").update({ role }).eq("id", memberId);
  return error ? { error: refused(error, "The role could not be changed.") } : done();
}

/** Switching someone off ends their access on their very next click: every page checks it. */
export async function setMemberActive(memberId: string, active: boolean): Promise<Result> {
  const user = await requireUser("team");
  if (!isId(memberId)) return { error: "That person could not be found." };
  if (memberId === user.id && !active) return { error: "You cannot switch yourself off." };
  const { error } = await (await supabaseServer()).from("profiles").update({ active }).eq("id", memberId);
  return error ? { error: refused(error, "That could not be changed.") } : done();
}

export async function createRole(name: string): Promise<Result> {
  await requireUser("team");
  name = name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 30 || !/^[\p{L}\p{N} ]+$/u.test(name)) return { error: "Use 2 to 30 letters or numbers for the role name." };
  const db = await supabaseServer();
  const { data: all } = await db.from("roles").select("name");
  if ((all ?? []).some((r) => r.name.toLowerCase() === name.toLowerCase())) return { error: "A role with that name already exists." };
  const made = await db.from("roles").insert({ name });
  if (made.error) return { error: withId("team", made.error, "The role could not be created.") };
  await db.from("role_permissions").insert({ role: name, permission: "view" });
  return done();
}

/** Anyone holding the role moves to Staff first. */
export async function deleteRole(name: string): Promise<Result> {
  await requireUser("team");
  if (BUILT_IN_ROLES.includes(name)) return { error: "The Owner, Manager and Staff roles cannot be removed." };
  const db = await supabaseServer();
  await db.from("profiles").update({ role: "Staff" }).eq("role", name);
  const { error } = await db.from("roles").delete().eq("name", name);
  return error ? { error: refused(error, "The role could not be removed.") } : done();
}

export async function setRolePermission(role: string, permission: string, on: boolean): Promise<Result> {
  await requireUser("team");
  if (!permissionList.some((p) => p.key === permission)) return { error: "That permission is not valid." };
  const db = await supabaseServer();
  const { data: r } = await db.from("roles").select("locked").eq("name", role).maybeSingle();
  if (!r) return { error: "That role could not be found." };
  if (r.locked) return { error: "The Owner can always do everything." };
  const { error } = on
    ? await db.from("role_permissions").upsert({ role, permission }, { onConflict: "role,permission" })
    : await db.from("role_permissions").delete().eq("role", role).eq("permission", permission);
  return error ? { error: refused(error, "That could not be changed.") } : done();
}

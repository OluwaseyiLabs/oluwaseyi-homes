"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  createRole,
  deleteRole,
  inviteMember,
  resendInvite,
  setMemberActive,
  setMemberRole,
  setRolePermission,
} from "@/app/admin/(dashboard)/team/actions";
import { Field, inputCls } from "@/components/Field";
import type { RoleRow, TeamMember } from "@/lib/data";
import { BUILT_IN_ROLES, permissionList } from "@/lib/permissions";
import { Badge, Card, PageHeader, btnGhost, btnPrimary } from "./ui";

const seen = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export function TeamManager({ members, roles, meId }: { members: TeamMember[]; roles: RoleRow[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [invite, setInvite] = useState({ email: "", name: "", role: "Staff" });
  const [newRole, setNewRole] = useState("");
  const assignable = roles.filter((r) => !r.locked);
  // The ticks change at once; the page's data catches up when the server has saved.
  const [ticks, setTicks] = useState(roles);
  useEffect(() => setTicks(roles), [roles]);
  const tick = (role: string, key: string, on: boolean) =>
    setTicks((list) => list.map((r) => (r.name !== role ? r : { ...r, can: on ? [...r.can, key] : r.can.filter((k) => k !== key) })));

  /** Runs a server action, shows what happened, and reloads the page's data. */
  const run = (action: () => Promise<{ error: string | null }>, ok: string, after?: () => void) =>
    start(async () => {
      setNote(null);
      const res = await action();
      setNote(res.error ? { ok: false, text: res.error } : { ok: true, text: ok });
      if (!res.error) after?.();
      router.refresh();
    });

  const sendInvite = (e: FormEvent) => {
    e.preventDefault();
    run(() => inviteMember(invite.email, invite.name, invite.role), `Invitation sent to ${invite.email.trim()}.`, () =>
      setInvite({ email: "", name: "", role: invite.role }),
    );
  };

  return (
    <>
      <PageHeader title="Team" text="Who can sign in to this dashboard, and what each person is allowed to do." />
      {note && (
        <p id="team-note" role={note.ok ? "status" : "alert"} className={`mb-4 rounded-xl p-4 text-sm font-medium ${note.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>
          {note.text}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {["Name", "Role", "Status", "Last signed in", ""].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => {
                const owner = m.role === "Owner";
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-4">
                      <span className="block font-semibold">{m.name}{m.id === meId && <span className="font-normal text-muted"> (you)</span>}</span>
                      <span className="block text-muted">{m.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      {owner || m.id === meId ? (
                        <span className="font-semibold">{m.role}</span>
                      ) : (
                        <select
                          aria-label={`Role for ${m.name}`}
                          value={m.role}
                          disabled={pending}
                          onChange={(e) => run(() => setMemberRole(m.id, e.target.value), `${m.name} is now ${e.target.value}.`)}
                          className="min-h-11 rounded-xl border border-line bg-surface px-3"
                        >
                          {assignable.map((r) => <option key={r.name}>{r.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4"><Badge>{m.status}</Badge></td>
                    <td className="px-5 py-4 text-muted">{m.lastSignIn ? seen.format(new Date(m.lastSignIn)) : "Never"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {m.status === "Invited" && (
                          <button type="button" disabled={pending} onClick={() => run(() => resendInvite(m.id), `A new invitation was sent to ${m.email}.`)} className={btnGhost}>
                            Send invitation again
                          </button>
                        )}
                        {!owner && m.id !== meId && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => setMemberActive(m.id, m.status === "Off"), m.status === "Off" ? `${m.name} can sign in again.` : `${m.name} is switched off and cannot sign in.`)}
                            className={`${btnGhost} ${m.status === "Off" ? "" : "text-red-700"}`}
                          >
                            {m.status === "Off" ? "Switch on" : "Switch off"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Invite a team member</h2>
          <p className="mt-1 text-sm text-muted">They get an email with a link to choose a password.</p>
          <form onSubmit={sendInvite} noValidate className="mt-4 grid gap-4">
            <Field label="Name" name="invite-name" required>
              <input id="invite-name" value={invite.name} onChange={(e) => setInvite((i) => ({ ...i, name: e.target.value }))} autoComplete="off" className={inputCls} />
            </Field>
            <Field label="Email" name="invite-email" required>
              <input id="invite-email" type="email" value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} autoComplete="off" className={inputCls} />
            </Field>
            <Field label="Role" name="invite-role" required>
              <select id="invite-role" value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))} className={inputCls}>
                {assignable.map((r) => <option key={r.name}>{r.name}</option>)}
              </select>
            </Field>
            <button disabled={pending} className={btnPrimary}>{pending ? "Working…" : "Send invitation"}</button>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Roles and what they can do</h2>
            <p className="mt-1 text-sm text-muted">Tick or untick a box and it saves at once. The Owner can always do everything.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createRole(newRole), `The ${newRole.trim()} role was added.`, () => setNewRole(""));
            }}
            noValidate
            className="flex flex-wrap items-start gap-2"
          >
            <div>
              <label htmlFor="new-role" className="sr-only">New role name</label>
              <input
                id="new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="New role, for example Editor"
                className="block min-h-11 w-60 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
              />
            </div>
            <button type="submit" disabled={pending} className={btnGhost}>Add role</button>
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-3 pr-4 font-semibold">Action</th>
                {ticks.map((r) => (
                  <th key={r.name} scope="col" className="px-3 py-3 text-center font-semibold">
                    {r.name}
                    {!BUILT_IN_ROLES.includes(r.name) && (
                      <button
                        type="button"
                        onClick={() => window.confirm(`Remove the ${r.name} role? Anyone who has it becomes Staff.`) && run(() => deleteRole(r.name), `The ${r.name} role was removed.`)}
                        aria-label={`Remove the ${r.name} role`}
                        className="ml-1.5 inline-grid size-6 place-items-center rounded-full text-base leading-none text-red-700 transition hover:bg-red-50"
                      >
                        ×
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {permissionList.map((p) => (
                <tr key={p.key}>
                  <th scope="row" className="py-3 pr-4 font-medium">{p.label}</th>
                  {ticks.map((r) => (
                    <td key={r.name} className="px-3 py-1 text-center">
                      <label className="inline-grid size-11 cursor-pointer place-items-center has-[:disabled]:cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={r.locked || r.can.includes(p.key)}
                          disabled={r.locked || pending}
                          onChange={(e) => {
                            tick(r.name, p.key, e.target.checked);
                            run(() => setRolePermission(r.name, p.key, e.target.checked), `${r.name}: saved.`);
                          }}
                          aria-label={`${r.name}: ${p.label}`}
                          className="size-5 accent-green"
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

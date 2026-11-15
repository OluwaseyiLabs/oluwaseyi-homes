"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { changeMyPassword, setMyName, stageTestError } from "@/app/admin/(dashboard)/account/actions";
import { Field, inputCls } from "@/components/Field";
import { Card, btnPrimary } from "./ui";

export function AccountForm({ name, email, role }: { name: string; email: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(name);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [drill, setDrill] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (pw.next !== pw.confirm) return setPwError("The two new passwords do not match.");
    start(async () => {
      const res = await changeMyPassword(pw.current, pw.next);
      if (res?.error) setPwError(res.error);
    });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setMyName(value);
      setNote(res.error ? { ok: false, text: res.error } : { ok: true, text: "Your name is saved." });
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 max-w-xl gap-4">
    <Card>
      <form onSubmit={save} noValidate className="grid grid-cols-1 gap-4">
        <Field label="Display name" name="account-name" required>
          <input id="account-name" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="name" maxLength={80} className={inputCls} />
        </Field>
        <p className="text-sm text-muted">
          Signed in as {email} · {role}. Entries already in a lead’s history keep the name that was shown when they were made.
        </p>
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`rounded-xl p-4 text-sm font-medium ${note.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>
            {note.text}
          </p>
        )}
        <button disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save name"}</button>
      </form>
    </Card>
    <Card>
      <h2 className="text-lg font-bold">Change password</h2>
      <p className="mt-1 text-sm text-muted">After the change you are signed out on every device, this one included, and sign in again with the new password.</p>
      <form onSubmit={changePassword} noValidate className="mt-4 grid grid-cols-1 gap-4">
        <Field label="Current password" name="pw-current" required>
          <input id="pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="New password" name="pw-next" required>
          <input id="pw-next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="New password again" name="pw-confirm" required>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className={inputCls} />
        </Field>
        {pwError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{pwError}</p>}
        <button disabled={pending} className={btnPrimary}>{pending ? "Working…" : "Change password"}</button>
      </form>
    </Card>
    {role === "Owner" && (
      <Card>
        <h2 className="text-lg font-bold">Check that errors can be traced</h2>
        <p className="mt-1 text-sm text-muted">
          This makes the site log a harmless test error and shows you its ID. Search that ID in Vercel, Logs: you should find one line saying it was staged on purpose. Nothing is saved or sent.
        </p>
        {drill && (
          <p role={drill.ok ? "status" : "alert"} className={`mt-4 break-words rounded-xl p-4 text-sm font-medium ${drill.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>
            {drill.text}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            const res = await stageTestError();
            setDrill(res.error ? { ok: false, text: res.error } : { ok: true, text: res.message ?? "" });
          })}
          className={`${btnPrimary} mt-4`}
        >
          Send a test error
        </button>
      </Card>
    )}
    </div>
  );
}

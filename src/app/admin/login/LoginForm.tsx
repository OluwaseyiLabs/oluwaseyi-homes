"use client";

import { useActionState } from "react";
import { Field, inputCls } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { signIn } from "../actions";

export function LoginForm({ name, off, changed }: { name: string; off: boolean; changed: boolean }) {
  const [state, action, pending] = useActionState(signIn, { error: "", email: "" });
  return (
    <main className="grid min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-md">
        <Logo name={name} />
        <form action={action} className="mt-8 grid gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Sign in to the dashboard</h1>
          {changed && (
            <p id="login-changed" role="status" className="rounded-xl bg-green/10 p-3 text-sm font-medium text-green">
              Your password was changed and you were signed out on every device. Sign in with the new password.
            </p>
          )}
          {off && (
            <p id="login-off" role="status" className="rounded-xl bg-gold/20 p-3 text-sm">
              This account has been switched off. Ask the owner to switch it back on.
            </p>
          )}
          <Field label="Email" name="email" required>
            <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputCls} />
          </Field>
          <Field label="Password" name="password" required>
            <input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
          </Field>
          {state.error && (
            <p id="login-error" role="alert" className="text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep active:scale-[0.97] disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-sm text-muted">Accounts are created by invitation. Ask the owner if you need access.</p>
        </form>
      </div>
    </main>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Field, inputCls } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { acceptInvite } from "./actions";

export function JoinForm({ name, tokenHash, type }: { name: string; tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState(acceptInvite, { error: "" });
  // Mistakes are caught here, so the boxes keep what was typed. The server checks again.
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [mistake, setMistake] = useState("");
  return (
    <main className="grid min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-md">
        <Logo name={name} />
        <form
          action={action}
          noValidate
          onSubmit={(e) => {
            const problem = pw.length < 10 ? "Use a password of at least 10 characters." : pw !== again ? "The two passwords do not match." : "";
            setMistake(problem);
            if (problem) e.preventDefault();
          }}
          className="mt-8 grid gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-8"
        >
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome. Choose your password.</h1>
          <p className="text-sm text-muted">You will use it, with your email, to sign in to the dashboard.</p>
          <Field label="Password (at least 10 characters)" name="password" required>
            <input id="password" name="password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Type it again" name="confirm" required>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} />
          </Field>
          {(mistake || state.error) && <p id="join-error" role="alert" className="text-sm font-medium text-red-700">{mistake || state.error}</p>}
          <button
            disabled={pending || !tokenHash}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep active:scale-[0.97] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save password and sign in"}
          </button>
          {!tokenHash && <p className="text-sm text-red-700">This invitation link is incomplete. Open the whole link from the email.</p>}
        </form>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { requestNewLink } from "@/app/r/[token]/actions";

/** On an expired link: emails a fresh one to the address we already have. The page never says whether anything was sent. */
export function NewLinkButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const ask = () =>
    start(async () => {
      const res = await requestNewLink(token);
      setResult(res.error ? { ok: false, text: res.error } : { ok: true, text: "If this link was still waiting for you, a new one is on its way to the email address we have. It can take a minute to arrive." });
    });

  return (
    <div className="mt-6">
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mb-4 rounded-xl p-4 text-sm font-medium ${result.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>
          {result.text}
        </p>
      )}
      {!result?.ok && (
        <button type="button" onClick={ask} disabled={pending} className="inline-flex min-h-12 items-center rounded-full bg-green px-6 font-semibold text-white transition hover:bg-green-deep disabled:opacity-60">
          {pending ? "Sending…" : "Email me a new link"}
        </button>
      )}
    </div>
  );
}

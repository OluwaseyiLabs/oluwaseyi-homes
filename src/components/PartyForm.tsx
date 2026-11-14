"use client";

import { useState, useTransition } from "react";
import { acknowledge, answerFollowUp } from "@/app/r/[token]/actions";
import { Field, inputCls } from "./Field";

const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep active:scale-[0.97] disabled:opacity-60 sm:w-auto";

function YesNo({ legend, name, value, onChange }: { legend: string; name: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <fieldset>
      <legend className="text-base font-semibold">{legend}</legend>
      <div className="mt-3 flex gap-2">
        {[true, false].map((v) => (
          <label
            key={String(v)}
            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-line px-6 font-semibold transition has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:checked]:text-green has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green/30"
          >
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="size-4 accent-green" />
            {v ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The form behind an emailed link: an owner acknowledging an introduction, or either side answering a follow-up. */
export function PartyForm({
  token,
  purpose,
  party,
  kind,
  leadCode,
  property,
  customerName,
  canReport,
}: {
  token: string;
  purpose: string;
  party: "customer" | "owner";
  kind: "Rent" | "Buy";
  leadCode: string;
  property: string;
  customerName: string;
  /** False once a completion has already been checked by the team. */
  canReport: boolean;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [inspected, setInspected] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [report, setReport] = useState({ date: "", price: "", evidence: "" });
  const deal = kind === "Rent" ? "rental" : "sale";

  const send = (action: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError("");
      const res = await action();
      if (res.error) setError(res.error);
      else setDone(true);
    });

  if (done) {
    return (
      <div role="status">
        <h1 className="text-2xl font-extrabold tracking-tight">Thank you.</h1>
        <p className="mt-3 text-lg text-muted">
          {purpose === "owner-ack"
            ? "Your acknowledgement is recorded. Once we approve the enquiry, the customer will receive your contact details."
            : "Your answers are recorded."}
        </p>
      </div>
    );
  }

  if (purpose === "owner-ack") {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight">A customer wants your property</h1>
        <p className="mt-3 text-lg text-muted">
          We are introducing <strong className="text-ink">{customerName}</strong> to you for <strong className="text-ink">{property}</strong>.
        </p>
        <p className="mt-4 text-sm text-muted">
          By acknowledging, you confirm that this customer comes to you through Oluwaseyi Homes &amp; Properties, under
          reference {leadCode} and the Property Listing and Agency Agreement you accepted. We then release your WhatsApp
          number and email to them.
        </p>
        {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
        <button type="button" disabled={pending} onClick={() => send(() => acknowledge(token))} className={`${btn} mt-6`}>
          {pending ? "Recording…" : "I acknowledge this introduction"}
        </button>
      </>
    );
  }

  const reporting = party === "owner" && completed === true && canReport;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (inspected === null || completed === null) return setError("Answer both questions.");
        send(() => answerFollowUp(token, { inspected, completed, ...report }));
      }}
    >
      <h1 className="text-2xl font-extrabold tracking-tight">How did it go?</h1>
      <p className="mt-3 text-lg text-muted">
        About <strong className="text-ink">{property}</strong>, reference {leadCode}.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6">
        <YesNo legend="Did the inspection take place?" name="inspected" value={inspected} onChange={setInspected} />
        <YesNo legend={`Has the ${deal} been completed?`} name="completed" value={completed} onChange={setCompleted} />
        {reporting && (
          <div className="grid grid-cols-1 gap-5 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">
              Tell us when it was completed and the final amount agreed. We check this before any fee is invoiced.
            </p>
            <Field label="Completion date" name="party-date" required>
              <input id="party-date" type="date" value={report.date} onChange={(e) => setReport((r) => ({ ...r, date: e.target.value }))} className={inputCls} />
            </Field>
            <Field label={kind === "Rent" ? "Final agreed annual rent" : "Final agreed price"} name="party-price" required>
              <input id="party-price" inputMode="numeric" value={report.price} onChange={(e) => setReport((r) => ({ ...r, price: e.target.value }))} placeholder="Amount in naira" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Supporting evidence" name="party-evidence">
                <input id="party-evidence" value={report.evidence} onChange={(e) => setReport((r) => ({ ...r, evidence: e.target.value }))} placeholder="For example, signed tenancy agreement dated 20 November" className={inputCls} />
              </Field>
            </div>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}
      <button disabled={pending} className={`${btn} mt-6`}>{pending ? "Sending…" : "Send my answers"}</button>
    </form>
  );
}

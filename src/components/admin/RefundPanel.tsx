"use client";

import { useState } from "react";
import { checkRefund, recordManualRefund, refundListingFee } from "@/app/admin/(dashboard)/submissions/actions";
import { reasonById } from "@/lib/refunds";
import type { Submission } from "@/lib/submissions";
import { naira } from "@/lib/validation";
import { Badge, btnGhost, btnPrimary } from "./ui";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const when = (iso: string) => fmt.format(new Date(iso));

/** What happened to a rejected submission's listing fee, and the buttons to refund it (only for people who may). */
export function RefundPanel({
  s,
  canRefund,
  pending,
  run,
}: {
  s: Submission;
  canRefund: boolean;
  pending: boolean;
  run: (action: () => Promise<{ error: string | null; info?: string }>) => void;
}) {
  const [note, setNote] = useState("");
  const r = s.refund;
  const reason = s.rejection ? reasonById(s.rejection.reasonId) : undefined;
  const fee = s.agreement.listingFee;
  const decision = s.rejection?.refundDecision;
  const sendNow = () => window.confirm(`Refund ${naira(fee)} to the owner now? This moves real money out of your Paystack balance and cannot be undone.`) && run(() => refundListingFee(s.dbId));

  return (
    <div id="sub-refund" className="mt-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Rejected, and the listing fee</h3>
        {r ? <Badge>{r.status === "Started" ? "Refund started" : r.status === "Refunded" ? "Refunded" : "Refund failed"}</Badge> : <Badge>{decision ? "Refund to be sent" : "Not refunded"}</Badge>}
      </div>
      <p className="mt-2 text-sm text-muted">
        {reason ? `Reason: ${reason.label}.` : "Rejected."}{s.rejection?.note ? ` Message to the owner: ${s.rejection.note}` : ""}
      </p>
      <p className="mt-1 text-sm text-muted">Paid {naira(fee)} by Paystack, reference <span className="break-all font-mono text-xs">{s.agreement.paymentRef}</span>.</p>

      {r?.status === "Started" && (
        <p className="mt-3 text-sm font-medium">
          Refund of {naira(r.amount)} started on {when(r.at)} by {r.by}. Paystack is sending it back to the card the owner paid with. This normally takes 5 to 10 working days.
        </p>
      )}
      {r?.status === "Refunded" && (
        <p className="mt-3 text-sm font-medium text-green">
          Refunded {naira(r.amount)}{r.completedAt ? ` on ${when(r.completedAt)}` : ""} ({r.method === "Manual" ? `made outside this system by ${r.by}${r.note ? `: ${r.note}` : ""}` : "through Paystack"}).
        </p>
      )}
      {r?.status === "Failed" && <p className="mt-3 text-sm font-medium text-red-700">The refund failed: {r.failure || "Paystack did not say why."}</p>}
      {!r && decision === true && (
        <p className="mt-3 text-sm font-medium">The refund was promised to the owner but has not been sent yet.{canRefund ? "" : " Someone with the refunds permission must send it."}</p>
      )}
      {!r && decision !== true && <p className="mt-3 text-sm text-muted">No refund, as decided when it was rejected.</p>}
      {!canRefund && <p className="mt-3 text-xs text-muted">Only people with the refunds permission can see the refund's progress and send money.</p>}

      {canRefund && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {(!r || r.status === "Failed") && (
              <button type="button" disabled={pending} onClick={sendNow} className={btnPrimary}>
                {pending ? "Working…" : r?.status === "Failed" ? "Try the refund again" : decision === true ? "Refund the listing fee" : "Refund anyway"}
              </button>
            )}
            {r?.status === "Started" && r.method === "Paystack" && (
              <button type="button" disabled={pending} onClick={() => run(() => checkRefund(s.dbId))} className={btnGhost}>
                {pending ? "Checking…" : "Check status with Paystack"}
              </button>
            )}
          </div>
          {(!r || r.status === "Failed") && (
            <details className="rounded-xl border border-line bg-surface p-3">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold leading-[2.75rem]">Refunded another way? Record it</summary>
              <p className="mt-1 text-sm text-muted">For a refund made outside this site, for example from your Paystack dashboard or by bank transfer. The owner is emailed that it is complete.</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} aria-label="How and when it was refunded" placeholder="For example: bank transfer on 20 Nov, receipt 12345" className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-green focus:ring-2 focus:ring-green/20" />
              <button
                type="button"
                disabled={pending || note.trim().length < 5}
                onClick={() => window.confirm("Record this refund as done? The owner will be emailed that it is complete.") && run(() => recordManualRefund(s.dbId, note))}
                className={`${btnGhost} mt-2`}
              >
                Record this refund
              </button>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

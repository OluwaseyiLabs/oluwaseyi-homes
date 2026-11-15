"use client";

import { useEffect, useRef, useState } from "react";
import { Field, inputCls } from "@/components/Field";
import { REJECT_REASONS, reasonById } from "@/lib/refunds";
import { naira } from "@/lib/validation";
import { btnGhost, btnPrimary } from "./ui";

/**
 * Rejecting a submission: why, what to tell the owner, and whether their listing fee is refunded. The reason suggests
 * the answer from the Refund Policy, and the person can change it. Nothing happens until "Reject" is pressed.
 */
export function RejectDialog({
  code,
  ownerName,
  fee,
  canRefund,
  pending,
  onClose,
  onReject,
}: {
  code: string;
  ownerName: string;
  fee: number;
  canRefund: boolean;
  pending: boolean;
  onClose: () => void;
  onReject: (reasonId: string, note: string, refund: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState<boolean | null>(null);
  const reason = reasonById(reasonId);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const choose = (id: string) => {
    setReasonId(id);
    // The Refund Policy's answer for that reason; "another reason" leaves the choice to the person.
    setRefund(reasonById(id)?.refund ?? null);
  };
  const ready = !!reason && refund !== null && (reason.id !== "other" || note.trim().length >= 3);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label="Reject this submission"
      className="m-auto max-h-[92svh] w-[min(34rem,calc(100%-1.5rem))] overflow-y-auto glass-panel glass-scrim rounded-3xl border border-white/60 p-0 text-ink"
    >
      <form
        className="p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onReject(reasonId, note, !!refund);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Reject this submission</h2>
            <p className="mt-1 text-sm text-muted">{code} from {ownerName}. They will be emailed the reason.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-2xl transition hover:bg-line">×</button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <Field label="Why is it being rejected?" name="reject-reason" required>
            <select id="reject-reason" value={reasonId} onChange={(e) => choose(e.target.value)} className={inputCls}>
              <option value="">Choose a reason</option>
              {REJECT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Message to the owner" name="reject-note" required={reason?.id === "other"}>
            <textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={`${inputCls} py-3`} placeholder="Added to the email, after the reason above." />
          </Field>

          <fieldset>
            <legend className="text-sm font-semibold">The listing fee ({naira(fee)})</legend>
            {reason && reason.refund !== null && (
              <p className="mt-1 text-sm text-muted">Your Refund Policy says: {reason.refund ? "refunded in full in this case." : "not refunded in this case."} You can change it.</p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([[true, `Refund ${naira(fee)} in full`], [false, "Do not refund"]] as const).map(([value, label]) => (
                <label key={String(value)} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 text-sm font-semibold has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green/30">
                  <input type="radio" name="refund" checked={refund === value} onChange={() => setRefund(value)} className="size-4 accent-green" />
                  {label}
                </label>
              ))}
            </div>
            {refund === true && !canRefund && (
              <p className="mt-2 rounded-xl bg-gold/20 p-3 text-sm">You can reject and promise the refund, but only someone with the refunds permission can send the money. Ask them to open this submission afterwards.</p>
            )}
            {refund === true && canRefund && <p className="mt-2 text-sm text-muted">The refund starts as soon as you press Reject. It goes back to the card the owner paid with, usually within 5 to 10 working days.</p>}
          </fieldset>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button disabled={!ready || pending} className={btnPrimary}>{pending ? "Rejecting…" : "Reject and email the owner"}</button>
          <button type="button" onClick={() => ref.current?.close()} className={btnGhost}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { editOwnerContact, setListingOwner } from "@/app/admin/(dashboard)/properties/actions";
import { Field, inputCls } from "@/components/Field";
import type { Listing } from "@/lib/listings";
import { dealFee } from "@/lib/pricing";
import { useSite } from "@/components/SiteProvider";
import { naira } from "@/lib/validation";
import { btnGhost, btnPrimary } from "./ui";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

/**
 * The owner of a property and the agreement they accepted. A property the owner listed through the website arrives
 * with both. For one the team sourced itself, the team adds the owner here and records the agreement as accepted,
 * which is what lets a customer's contact request be approved.
 */
export function OwnerPanel({
  listingId,
  category,
  owner,
  agreement,
  canApprove,
}: {
  listingId: string;
  category: string;
  owner?: Listing["owner"];
  agreement?: Listing["agreement"];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(true);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState({ name: owner?.name ?? "", whatsapp: owner?.whatsapp ?? "", email: owner?.email ?? "" });
  const rent = category === "Rent";
  const { pricing } = useSite();
  const fee = dealFee(pricing, category);

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("listingId", listingId);
    start(async () => {
      setError("");
      const res = await setListingOwner(form);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function saveContact(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      setError("");
      const res = await editOwnerContact(owner!.id, contact.name, contact.whatsapp, contact.email);
      if (res.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (owner && agreement) {
    return (
      <div id="owner-panel">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Owner ({owner.code})</dt><dd className="mt-1 font-semibold">{owner.name}</dd></div>
          <div><dt className="text-muted">WhatsApp</dt><dd className="mt-1 font-semibold">{owner.whatsapp}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Email</dt><dd className="mt-1 break-words font-semibold">{owner.email}</dd></div>
          <div>
            <dt className="text-muted">Agreement (version {agreement.version})</dt>
            <dd className="mt-1 font-semibold">
              {fmt.format(new Date(agreement.acceptedAt))},{" "}
              {agreement.via === "recorded by team" ? `recorded by ${agreement.recordedBy ?? "the team"}` : "accepted by the owner online"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Listing fee</dt>
            <dd className="mt-1 font-semibold">
              {agreement.listingFee > 0 ? `${naira(agreement.listingFee)}, reference ${agreement.paymentRef}` : "Waived"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{rent ? "Agency fee" : "Sale commission"}</dt>
            <dd className="mt-1 font-semibold">{agreement.feePct}% of the {rent ? "annual rent" : "sale price"}</dd>
          </div>
          <div><dt className="text-muted">Protection period</dt><dd className="mt-1 font-semibold">{agreement.protectionMonths} months from each introduction</dd></div>
          {agreement.proofNote && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Proof held</dt>
              <dd className="mt-1 font-semibold">
                {agreement.proofNote}
                {agreement.proofUrl && (
                  <>
                    {" · "}
                    <a href={agreement.proofUrl} target="_blank" rel="noreferrer" className="text-green underline underline-offset-4">View the file</a>
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
        {canApprove &&
          (editing ? (
            <form onSubmit={saveContact} noValidate className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-3">
              <Field label="Name" name="oc-name" required>
                <input id="oc-name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="WhatsApp number" name="oc-whatsapp" required>
                <input id="oc-whatsapp" value={contact.whatsapp} onChange={(e) => setContact((c) => ({ ...c, whatsapp: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Email" name="oc-email" required>
                <input id="oc-email" type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className={inputCls} />
              </Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                <button disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save contact details"}</button>
                <button type="button" onClick={() => setEditing(false)} className={btnGhost}>Cancel</button>
                <span className="text-xs text-muted">The change is recorded in the history.</span>
              </div>
            </form>
          ) : (
            <button type="button" id="edit-owner" onClick={() => setEditing(true)} className={`${btnGhost} mt-4`}>Edit contact details</button>
          ))}
        {error && <p id="owner-error" role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      </div>
    );
  }

  if (!canApprove) {
    return (
      <p id="owner-panel" className="text-sm text-muted">
        No owner is on record for this property yet. Someone whose role can approve submissions adds the owner and records the agreement.
      </p>
    );
  }

  return (
    <form id="owner-panel" onSubmit={save} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">
        Use this for a property you found yourself. Add the owner and record that they agreed to the Property Listing and Agency
        Agreement. Until you do, no customer can be given this owner&apos;s contact.
      </p>
      <Field label="Owner's name" name="ow-name" required>
        <input id="ow-name" name="name" autoComplete="off" className={inputCls} />
      </Field>
      <Field label="Owner's WhatsApp number" name="ow-whatsapp" required>
        <input id="ow-whatsapp" name="whatsapp" type="tel" autoComplete="off" className={inputCls} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Owner's email" name="ow-email" required>
          <input id="ow-email" name="email" type="email" autoComplete="off" className={inputCls} />
        </Field>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-4 text-sm sm:col-span-2">
        <p className="font-semibold">Terms the owner agrees to</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><dt className="text-muted">{rent ? "Agency fee" : "Sale commission"}</dt><dd className="mt-0.5 font-semibold">{fee.amount}, paid by the {rent ? "landlord" : "seller"}</dd></div>
          <div><dt className="text-muted">Protection period</dt><dd className="mt-0.5 font-semibold">{pricing.protectionMonths} months from each introduction</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Fee becomes payable</dt><dd className="mt-0.5 font-semibold">{fee.due}</dd></div>
          <div><dt className="text-muted">Agreement version</dt><dd className="mt-0.5 font-semibold">{pricing.agreementVersion}</dd></div>
        </dl>
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-semibold">Property listing fee ({naira(pricing.listingFee)})</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ v: true, label: "Paid by transfer" }, { v: false, label: "Waived" }].map((o) => (
            <label key={o.label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-5 text-sm font-medium has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:checked]:text-green">
              <input type="radio" name="feeMode" value={o.v ? "paid" : "waived"} checked={paid === o.v} onChange={() => setPaid(o.v)} className="size-4 accent-green" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {paid && (
        <div className="sm:col-span-2">
          <Field label="Payment reference" name="ow-ref" required>
            <input id="ow-ref" name="transferRef" placeholder="For example, the bank transfer reference" className={inputCls} />
          </Field>
        </div>
      )}
      <Field label="Date the owner agreed" name="ow-date" required>
        <input id="ow-date" name="acceptedOn" type="date" max={today()} className={inputCls} />
      </Field>
      <Field label="What is the proof?" name="ow-note" required>
        <input id="ow-note" name="proofNote" placeholder="For example, signed paper agreement" className={inputCls} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Photo or PDF of the proof" name="ow-proof">
          <input id="ow-proof" name="proof" type="file" accept="image/*,application/pdf" className={`${inputCls} py-3`} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-sm font-semibold sm:col-span-2">
        <input id="ow-confirm" name="confirm" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-green" />
        <span>
          The owner has agreed to the Property Listing and Agency Agreement, and I hold the proof.
          <span className="block font-normal text-muted">This is recorded under your name and cannot be changed afterwards.</span>
        </span>
      </label>
      {error && <p id="owner-error" role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save the owner and agreement"}</button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  checkPayment,
  confirmInspection,
  declineLead,
  issueInvoice,
  linkProperty,
  recordManualPayment,
  recordOwnerAck,
  releaseContact,
  reportCompletion,
  requestOwnerAck,
  resendContact,
  sendFollowUpNow,
  setStatus,
  verifyCompletion,
} from "@/app/admin/(dashboard)/leads/actions";
import { Field, inputCls } from "@/components/Field";
import { LEAD_STATUSES, confirmedText, inspectionText, releaseBlockers, successStatus, type Lead, type LeadStatus } from "@/lib/leads";
import { formatBudget, naira } from "@/lib/validation";
import { OwnerPanel } from "./OwnerPanel";
import { Badge, Card, PageHeader, btnGhost, btnPrimary } from "./ui";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const when = (iso?: string) => (iso ? fmt.format(new Date(iso)) : "Not yet");
const step = (l: Lead) => LEAD_STATUSES.indexOf(l.status);
const closed = (l: Lead) => step(l) >= LEAD_STATUSES.indexOf("Successfully Rented");
const flagged = (l: Lead) => !!l.suspect || l.conflict || l.status === "Disputed";

const inspection = (l: Lead) =>
  l.status === "Inspection Scheduled" ? "Scheduled" : step(l) >= 3 && step(l) <= 7 ? "Completed" : "Not yet";
const negotiation = (l: Lead) =>
  l.status === "Negotiation" ? "In progress" : step(l) >= 5 && step(l) <= 7 ? "Agreed" : "Not started";
const outcome = (l: Lead) => (closed(l) ? l.status : "Open");
const payer = (l: Lead) => (l.kind === "Rent" ? "landlord" : "seller");
const feeTerms = (l: Lead) => (l.agreement ? `${l.agreement.feePct}% of the final ${l.kind === "Rent" ? "rent" : "price"}` : "No agreement");
const payment = (l: Lead) => (l.invoice === "Paid" ? `Paid, receipt ${l.receipt}` : l.invoice === "Issued" ? "Awaiting payment" : "Nothing due");

interface Property {
  dbId: string;
  code: string;
  category: string;
  label: string;
}
const blank = { status: "", kind: "", property: "", owner: "", customer: "", from: "", to: "" };

export function LeadManager({
  initialId,
  leads,
  properties,
  can,
}: {
  initialId?: string;
  leads: Lead[];
  properties: Property[];
  can: { change: boolean; release: boolean; approve: boolean };
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState(initialId ?? leads[0]?.id);
  const [f, setF] = useState(blank);
  const [report, setReport] = useState({ date: "", price: "", evidence: "" });
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  /** Runs a server action, shows its error if it refuses, and reloads the page's data. */
  const run = (action: () => Promise<{ error: string | null }>, after?: () => void) =>
    start(async () => {
      setError("");
      const res = await action();
      if (res.error) setError(res.error);
      else after?.();
      router.refresh();
    });

  if (leads.length === 0) {
    return (
      <>
        <PageHeader title="Leads and transactions" text="Every customer introduced to an owner, from first enquiry to the fee being paid." />
        <Card><p className="text-muted">No enquiries yet. They appear here as soon as a customer confirms their email code.</p></Card>
      </>
    );
  }

  const day = (iso: string) => iso.slice(0, 10);
  const shown = leads.filter((l) => {
    const text = `${l.customer.name} ${l.customer.email} ${l.customer.phone} ${l.id}`.toLowerCase();
    return (
      (!f.status || (f.status === "Needs review" ? flagged(l) : l.status === f.status)) &&
      (!f.kind || l.kind === f.kind) &&
      (!f.property || l.listing?.code === f.property) &&
      (!f.owner || l.owner?.code === f.owner) &&
      (!f.customer || text.includes(f.customer.toLowerCase())) &&
      (!f.from || day(l.introducedAt) >= f.from) &&
      (!f.to || day(l.introducedAt) <= f.to)
    );
  });
  const open = leads.find((l) => l.id === openId) ?? leads[0];
  const missing = releaseBlockers(open);
  const released = !!open.releasedAt;
  const won = successStatus(open);
  const owners = [...new Map(leads.filter((l) => l.owner).map((l) => [l.owner!.code, l.owner!])).values()];
  const linked = [...new Map(leads.filter((l) => l.listing).map((l) => [l.listing!.code, l.listing!])).values()];
  const candidates = properties.filter((p) => p.category === open.enquiryType);

  /** Lagos time as the date-and-time box wants it ("2026-11-21T10:00"). Lagos is a fixed UTC+1. */
  const toBox = (iso: string) => new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 16);
  const ownerTimes = open.inspection?.ownerTimes ?? [];
  const reschedule = released;
  const planner = can.change && !closed(open) && (reschedule || open.ownerAck) ? (
    <form
      noValidate
      className="mt-5 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => confirmInspection(open.dbId, slot), () => setSlot(""));
      }}
    >
      <label htmlFor="lead-inspect" className="text-sm font-semibold">
        {open.inspection?.confirmedFor ? "Change the inspection time" : "Confirm the inspection time"}
      </label>
      <p className="mt-0.5 text-xs text-muted">
        {reschedule ? "Lagos time. The customer and the owner are both emailed the new time." : "Lagos time. Nothing is sent now: the time goes out in the release email to the customer and the owner."}
      </p>
      {!reschedule && (
        <div className="mt-2 text-sm">
          <p><span className="text-muted">Customer asked for:</span> <strong>{open.inspection?.date ? inspectionText(open.inspection.date, open.inspection.slot) : "No time given"}</strong></p>
          <p className="mt-1">
            <span className="text-muted">Owner says:</span>{" "}
            <strong>{open.inspection?.ownerAgreed ? "The customer's time suits" : ownerTimes.length ? "These suit" : "No times given yet (reply by email?)"}</strong>
          </p>
          {ownerTimes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ownerTimes.map((t) => (
                <button key={t} type="button" onClick={() => setSlot(toBox(t))} className={`${btnGhost} min-h-10 px-4 text-sm`}>{confirmedText(t)}</button>
              ))}
            </div>
          )}
          {open.inspection?.ownerNote && <p className="mt-2 text-xs text-muted">Owner's note: {open.inspection.ownerNote}</p>}
        </div>
      )}
      <input id="lead-inspect" type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls} />
      <button disabled={pending || !slot} className={`${btnGhost} mt-3`}>{reschedule ? "Confirm and email both" : "Confirm this time"}</button>
    </form>
  ) : null;

  const set = (key: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [key]: e.target.value }));
  const filterCls = "mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Leads and transactions"
        text="Every customer introduced to an owner, from first enquiry to the fee being paid."
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-muted">Customer or Lead ID
            <input value={f.customer} onChange={set("customer")} placeholder="Name, email, phone or ID" className={filterCls} />
          </label>
          <label className="text-xs font-semibold text-muted">Status
            <select value={f.status} onChange={set("status")} className={filterCls}>
              <option value="">All statuses</option>
              <option>Needs review</option>
              {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Transaction type
            <select value={f.kind} onChange={set("kind")} className={filterCls}>
              <option value="">Rent and sale</option>
              <option value="Rent">Rent</option>
              <option value="Buy">Sale</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Property
            <select value={f.property} onChange={set("property")} className={filterCls}>
              <option value="">All properties</option>
              {linked.map((p) => <option key={p.code} value={p.code}>{p.title}, {p.location}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Owner
            <select value={f.owner} onChange={set("owner")} className={filterCls}>
              <option value="">All owners</option>
              {owners.map((o) => <option key={o.code} value={o.code}>{o.name} ({o.code})</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Introduced from
            <input type="date" value={f.from} onChange={set("from")} className={filterCls} />
          </label>
          <label className="text-xs font-semibold text-muted">Introduced to
            <input type="date" value={f.to} onChange={set("to")} className={filterCls} />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => setF(blank)} className={`${btnGhost} w-full`}>Clear filters</button>
          </div>
        </div>
      </Card>

      <Card className="mt-4 overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[84rem] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              {["Lead ID", "Customer", "Property", "Owner", "Introduced", "Contact released", "Inspection", "Negotiation", "Outcome", "Agreed fee", "Invoice", "Payment"].map((h) => (
                <th key={h} scope="col" className="px-4 py-3.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((l) => (
              <tr key={l.id} className={l.id === open.id ? "bg-panel" : undefined}>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(l.id);
                      setError("");
                    }}
                    aria-current={l.id === open.id}
                    className="font-semibold text-green underline underline-offset-4 tabular-nums"
                  >
                    {l.id}
                  </button>
                  {flagged(l) && <span className="mt-1 block"><Badge>Needs review</Badge></span>}
                </td>
                <td className="px-4 py-3.5 font-semibold">{l.customer.name}</td>
                <td className="px-4 py-3.5">{l.listing ? `${l.listing.title}, ${l.listing.location}` : "Not matched"}</td>
                <td className="px-4 py-3.5">{l.owner?.name ?? "None"}</td>
                <td className="px-4 py-3.5 text-muted">{when(l.introducedAt)}</td>
                <td className="px-4 py-3.5 text-muted">{when(l.releasedAt)}</td>
                <td className="px-4 py-3.5">{inspection(l)}</td>
                <td className="px-4 py-3.5">{negotiation(l)}</td>
                <td className="px-4 py-3.5"><Badge>{outcome(l)}</Badge></td>
                <td className="px-4 py-3.5">{feeTerms(l)}</td>
                <td className="px-4 py-3.5"><Badge>{l.invoice}</Badge></td>
                <td className="px-4 py-3.5">{payment(l)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-muted">No leads match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted tabular-nums">{open.id} · {open.kind === "Rent" ? "Rental" : "Sale"} · Source: {open.source}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{open.customer.name}</h2>
          </div>
          <Badge>{open.status}</Badge>
        </div>

        {error && <p id="lead-error" role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
        {open.suspect && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">Possible unreported deal. {open.suspect}</p>
        )}
        {open.conflict && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
            Conflicting answers. The customer and the owner answered a follow-up differently. Check with both before changing the status.
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-8 border-t border-line pt-6 lg:grid-cols-2">
          <section>
            <h3 className="text-lg font-bold">Customer</h3>
            <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Email</dt><dd className="mt-1 break-words font-semibold">{open.customer.email} <span className={open.customer.emailVerified ? "font-normal text-green" : "font-normal text-red-700"}>({open.customer.emailVerified ? "verified" : "not verified"})</span></dd></div>
              <div><dt className="text-muted">Phone</dt><dd className="mt-1 font-semibold">{open.customer.phone}</dd></div>
              <div><dt className="text-muted">Looking for</dt><dd className="mt-1 font-semibold">{[open.propertyType, open.location].filter(Boolean).join(" in ")}</dd></div>
              <div><dt className="text-muted">Budget</dt><dd className="mt-1 font-semibold">{open.budget ? formatBudget(open.budget) : "Not given"}</dd></div>
              <div><dt className="text-muted">Intended move-in date</dt><dd className="mt-1 font-semibold">{open.moveIn}</dd></div>
              <div><dt className="text-muted">Essential facilities</dt><dd className="mt-1 font-semibold">{open.facilities.join(", ") || "None chosen"}</dd></div>
              <div><dt className="text-muted">Tenant assistance service</dt><dd className="mt-1 font-semibold">{open.assistance ? "Requested" : "Not requested"}</dd></div>
              <div><dt className="text-muted">Acknowledged the introduction</dt><dd className="mt-1 font-semibold">{when(open.customerAck)}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Inspection</dt>
                <dd id="lead-inspection" className="mt-1 font-semibold">
                  {open.inspection?.confirmedFor
                    ? `Confirmed for ${confirmedText(open.inspection.confirmedFor)} (by ${open.inspection.confirmedBy})`
                    : open.inspection?.date
                      ? `Requested for ${inspectionText(open.inspection.date, open.inspection.slot)}. Not confirmed yet.`
                      : "Not requested"}
                  {!open.inspection?.confirmedFor && open.inspection?.ownerAgreed && <><br /><span className="font-normal text-muted">The owner says the customer's time suits.</span></>}
                  {!open.inspection?.confirmedFor && (open.inspection?.ownerTimes?.length ?? 0) > 0 && (
                    <><br /><span className="font-normal text-muted">Owner can do: {open.inspection!.ownerTimes!.map(confirmedText).join("; ")}.</span></>
                  )}
                </dd>
              </div>
            </dl>
            {open.note && <p className="mt-4 text-sm leading-relaxed">{open.note}</p>}
          </section>

          <section>
            <h3 className="text-lg font-bold">Property and owner</h3>
            {open.listing ? (
              <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2"><dt className="text-muted">Property ({open.listing.code})</dt><dd className="mt-1 font-semibold">{open.listing.title}, {open.listing.location}</dd></div>
                {open.owner && (
                  <>
                    <div><dt className="text-muted">Owner ({open.owner.code})</dt><dd className="mt-1 font-semibold">{open.owner.name}</dd></div>
                    <div><dt className="text-muted">WhatsApp</dt><dd className="mt-1 font-semibold">{open.owner.whatsapp}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-muted">Email</dt><dd className="mt-1 break-words font-semibold">{open.owner.email}</dd></div>
                  </>
                )}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted">This customer did not choose a property. Match them to one before you approve.</p>
            )}
            {open.listing && !open.owner && (
              <div className="mt-4">
                <p className="mb-4 text-sm font-medium text-red-700">This property has no owner on record, so there is no contact to release.</p>
                <OwnerPanel listingId={open.listing.dbId} category={open.kind} canApprove={can.approve} />
              </div>
            )}
            {can.change && !released && !closed(open) && (
              <label className="mt-4 block max-w-md text-sm font-semibold">
                {open.listing ? "Change the property" : "Match to a property"}
                <select
                  id="lead-property"
                  value={open.listing?.dbId ?? ""}
                  disabled={pending}
                  onChange={(e) => e.target.value && run(() => linkProperty(open.dbId, e.target.value))}
                  className={inputCls}
                >
                  <option value="">No property chosen</option>
                  {candidates.map((p) => <option key={p.dbId} value={p.dbId}>{p.label}</option>)}
                </select>
              </label>
            )}
            {open.agreement && (
              <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Agreement accepted</dt><dd className="mt-1 font-semibold">{when(open.agreement.acceptedAt)} (version {open.agreement.version})</dd></div>
                {open.agreement.listingFee !== undefined && <div><dt className="text-muted">Listing fee</dt><dd className="mt-1 font-semibold">{open.agreement.listingFee > 0 ? `${naira(open.agreement.listingFee)}, paid on listing` : "Waived"}</dd></div>}
                <div><dt className="text-muted">Agreed fee</dt><dd className="mt-1 font-semibold">{feeTerms(open)}, paid by the {payer(open)}</dd></div>
                <div><dt className="text-muted">Fee becomes payable</dt><dd className="mt-1 font-semibold">{open.agreement.feeDue}</dd></div>
                <div><dt className="text-muted">Protection period</dt><dd className="mt-1 font-semibold">{open.agreement.protectionMonths} months from the introduction</dd></div>
                <div><dt className="text-muted">Owner acknowledged this customer</dt><dd className="mt-1 font-semibold">{when(open.ownerAck)}</dd></div>
              </dl>
            )}
          </section>
        </div>

        <section className="mt-6 border-t border-line pt-6">
          <h3 className="text-lg font-bold">Contact release</h3>
          {released ? (
            <>
              <p className="mt-2 text-sm">Contact details were released on <strong>{when(open.releasedAt)}</strong>.</p>
              {can.release && (
                <button type="button" disabled={pending} onClick={() => run(() => resendContact(open.dbId))} className={`${btnGhost} mt-3`}>
                  Send the email again
                </button>
              )}
            </>
          ) : open.status === "Unsuccessful" ? (
            <p className="mt-2 text-sm text-muted">This enquiry was declined. No contact details were released.</p>
          ) : (
            <>
              {missing.length > 0 ? (
                <>
                  <p className="mt-2 text-sm font-semibold">Contact details cannot be released yet:</p>
                  <ul id="lead-missing" className="mt-2 grid grid-cols-1 list-disc gap-1 pl-5 text-sm text-red-700">
                    {missing.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-green">Agreement, acknowledgements and lead registration are complete.</p>
              )}
              {planner}
              {!open.ownerAck && open.listing && <p className="mt-3 text-xs text-muted">The inspection time can be confirmed as soon as the owner has acknowledged.</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                {can.release && (
                  <button type="button" disabled={pending || missing.length > 0} onClick={() => run(() => releaseContact(open.dbId))} className={btnPrimary}>
                    Approve and release contact
                  </button>
                )}
                {can.release && open.listing && open.agreement && !open.ownerAck && (
                  <button type="button" disabled={pending} onClick={() => run(() => requestOwnerAck(open.dbId))} className={btnGhost}>
                    Email the owner an acknowledgement link
                  </button>
                )}
                {can.release && open.listing && open.agreement && !open.ownerAck && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => window.confirm("Has the owner confirmed to you that they received this customer? This is recorded under your name.") && run(() => recordOwnerAck(open.dbId))}
                    className={btnGhost}
                  >
                    Record it myself
                  </button>
                )}
                {can.change && (
                  <button type="button" disabled={pending} onClick={() => run(() => declineLead(open.dbId))} className={`${btnGhost} text-red-700`}>
                    Decline
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {released && (
          <section className="mt-6 border-t border-line pt-6">
            <h3 className="text-lg font-bold">Transaction</h3>
            <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <label className="block max-w-sm text-sm font-semibold">
                  Status
                  <select
                    id="lead-status"
                    value={open.status}
                    disabled={!can.change || pending}
                    onChange={(e) => run(() => setStatus(open.dbId, e.target.value as LeadStatus))}
                    className={inputCls}
                  >
                    {LEAD_STATUSES.filter((s) => s !== "New Enquiry" && (!s.startsWith("Successfully") || s === won)).map((s) => (
                      <option key={s} disabled={(s === won && !open.completion?.verified) || s === "Contact Released"}>{s}</option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-muted">{won} can only be chosen after a reported completion has been checked.</p>
                {planner}
                {can.change && !closed(open) && (
                  <button type="button" disabled={pending} onClick={() => run(() => sendFollowUpNow(open.dbId))} className={`${btnGhost} mt-4`}>
                    Send follow-up now
                  </button>
                )}
                <p className="mt-2 text-xs text-muted">
                  Follow-ups also go out by themselves: 3 days after release, then weekly, up to 4 times. Sent so far: {open.followUpCount}.
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-muted">Inspection took place?</dt><dd className="mt-1 font-semibold">Customer: {open.followUps.customerInspected ?? "No answer"}<br />Owner: {open.followUps.ownerInspected ?? "No answer"}</dd></div>
                  <div><dt className="text-muted">Transaction completed?</dt><dd className="mt-1 font-semibold">Customer: {open.followUps.customerCompleted ?? "No answer"}<br />Owner: {open.followUps.ownerCompleted ?? "No answer"}</dd></div>
                </dl>
              </div>

              <div>
                {open.completion ? (
                  <>
                    <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted">Completion date</dt><dd className="mt-1 font-semibold">{open.completion.date}</dd></div>
                      <div><dt className="text-muted">Final agreed {open.kind === "Rent" ? "rent" : "price"}</dt><dd className="mt-1 font-semibold">{naira(open.completion.price)}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-muted">Supporting evidence</dt><dd className="mt-1 font-semibold">{open.completion.evidence || "None given"}</dd></div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted">Fee due from the {payer(open)}</dt>
                        <dd id="lead-fee" className="mt-1 text-2xl font-extrabold tracking-tight text-green">{naira(open.feeAmount ?? 0)}</dd>
                        <dd className="text-muted">{open.agreement?.feePct}% of {naira(open.completion.price)}, under agreement version {open.agreement?.version}.</dd>
                      </div>
                    </dl>
                    {can.change && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {!open.completion.verified ? (
                          <button type="button" disabled={pending} onClick={() => run(() => verifyCompletion(open.dbId, won))} className={btnPrimary}>
                            Evidence checked: confirm completion
                          </button>
                        ) : open.invoice === "Not issued" ? (
                          <button type="button" disabled={pending} onClick={() => run(() => issueInvoice(open.dbId))} className={btnPrimary}>
                            Issue and email invoice for {naira(open.feeAmount ?? 0)}
                          </button>
                        ) : open.invoice === "Issued" ? (
                          <>
                            <button type="button" disabled={pending} onClick={() => run(() => checkPayment(open.dbId))} className={btnPrimary}>
                              Check Paystack payment
                            </button>
                            <button type="button" disabled={pending} onClick={() => run(() => issueInvoice(open.dbId))} className={btnGhost}>
                              Send invoice again
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => window.confirm("Record this invoice as paid outside Paystack? Do this only after you have seen the money arrive. A receipt is emailed to the owner.") && run(() => recordManualPayment(open.dbId))}
                              className={btnGhost}
                            >
                              Paid another way
                            </button>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-green">Paid. Receipt {open.receipt}.</p>
                        )}
                      </div>
                    )}
                    {!open.completion.verified && <p className="mt-2 text-xs text-muted">No invoice can be issued until the evidence has been checked.</p>}
                  </>
                ) : closed(open) || !can.change ? null : (
                  <form
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => reportCompletion(open.dbId, report.date, report.price, report.evidence), () => setReport({ date: "", price: "", evidence: "" }));
                    }}
                  >
                    <p className="text-sm font-semibold sm:col-span-2">Record a reported completion</p>
                    <Field label="Completion date" name="lead-date" required>
                      <input id="lead-date" type="date" value={report.date} onChange={(e) => setReport((r) => ({ ...r, date: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label={`Final agreed ${open.kind === "Rent" ? "annual rent" : "price"}`} name="lead-price" required>
                      <input id="lead-price" inputMode="numeric" value={report.price} onChange={(e) => setReport((r) => ({ ...r, price: e.target.value }))} className={inputCls} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Supporting evidence" name="lead-evidence">
                        <input id="lead-evidence" value={report.evidence} onChange={(e) => setReport((r) => ({ ...r, evidence: e.target.value }))} placeholder="For example, signed tenancy agreement" className={inputCls} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2"><button disabled={pending} className={btnGhost}>Save reported completion</button></div>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 border-t border-line pt-6">
          <h3 className="text-lg font-bold">History</h3>
          <p className="mt-1 text-sm text-muted">Every action is recorded with its time and who did it. Entries cannot be edited or deleted.</p>
          <ol id="lead-history" className="mt-4 grid grid-cols-1 gap-3 text-sm">
            {open.history.map((a, i) => (
              <li key={i} className="grid grid-cols-1 gap-x-4 sm:grid-cols-[11rem_8rem_minmax(0,1fr)]">
                <span className="text-muted tabular-nums">{when(a.at)}</span>
                <span className="font-semibold">{a.by}</span>
                <span>{a.what}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className="mt-6 text-xs text-muted">Times are shown in Lagos time.</p>
      </Card>
    </>
  );
}

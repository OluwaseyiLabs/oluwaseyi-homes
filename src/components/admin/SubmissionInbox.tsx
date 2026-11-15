"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveSubmission, markRead, rejectSubmission, sendApprovalEmail, setSubmissionStatus } from "@/app/admin/(dashboard)/submissions/actions";
import { CostBreakdown } from "@/components/CostBreakdown";
import { formatDetail, type DetailField } from "@/lib/listings";
import type { Submission } from "@/lib/submissions";
import { naira } from "@/lib/validation";
import { PhotoGrid } from "./PhotoGrid";
import { RefundPanel } from "./RefundPanel";
import { RejectDialog } from "./RejectDialog";
import { Badge, Card, PageHeader, btnGhost, btnPrimary } from "./ui";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const when = (iso: string) => fmt.format(new Date(iso));
const kind = (s: Submission) => `Property to ${s.purpose === "Rent" ? "rent" : "sell"}`;

export function SubmissionInbox({
  initialId,
  submissions,
  detailFields,
  canApprove,
  canRefund,
}: {
  initialId?: string;
  submissions: Submission[];
  detailFields: DetailField[];
  canApprove: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState(initialId ?? submissions[0]?.id);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ error: string | null; info?: string }>) =>
    start(async () => {
      setError("");
      setInfo("");
      const res = await action();
      if (res.error) setError(res.error);
      if (res.info) setInfo(res.info);
      router.refresh();
    });

  if (submissions.length === 0) {
    return (
      <>
        <PageHeader title="Submissions" text="Properties that owners sent in through the List Property form." />
        <Card><p className="text-muted">No submissions yet. They appear here as soon as an owner pays the listing fee and submits a property.</p></Card>
      </>
    );
  }

  const open = submissions.find((s) => s.id === openId) ?? submissions[0];
  const answered = detailFields.filter((f) => open.details[f.id]);
  const facts = (
    [
      ["Area or neighbourhood", open.neighbourhood],
      ["Bedrooms", open.bedrooms ? String(open.bedrooms) : ""],
      ["Available facilities", open.facilities.join(", ")],
      ["What the service charge covers", open.serviceCovers],
      ["Parking", open.parking],
      ["Security", open.security],
      ["Inspection availability", open.inspection],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const settled = open.status === "Approved" || open.status === "Rejected";

  const select = (s: Submission) => {
    setOpenId(s.id);
    setError("");
    if (s.unread) run(() => markRead(s.dbId));
  };

  return (
    <>
      <PageHeader title="Submissions" text="Properties that owners sent in through the List Property form." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="p-2 sm:p-2">
          <ul>
            {submissions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => select(s)}
                  aria-current={s.id === open.id}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                    s.id === open.id ? "bg-panel" : "hover:bg-panel/60"
                  }`}
                >
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${s.unread ? "bg-gold" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${s.unread ? "font-bold" : "font-semibold"}`}>
                      {kind(s)}: {s.propertyType}
                    </span>
                    <span className="block truncate text-sm text-muted">{s.neighbourhood}</span>
                    <span className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted">{when(s.receivedAt)}</span>
                      <Badge>{s.status}</Badge>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted tabular-nums">{open.id} · {kind(open)} · {when(open.receivedAt)}</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                {open.propertyType}, {naira(open.amount)}{open.purpose === "Rent" ? " / year" : ""}
              </h2>
              <p className="mt-1 text-muted">{open.address}, {open.neighbourhood}</p>
            </div>
            <Badge>{open.status}</Badge>
          </div>

          {info && <p id="sub-info" role="status" className="mt-5 rounded-xl bg-green/10 p-4 text-sm font-medium text-green">{info}</p>}
          {error && <p id="sub-error" role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

          {open.photos.length > 0 ? <PhotoGrid key={open.id} photos={open.photos} /> : <p className="mt-6 text-sm text-muted">The photos could not be loaded.</p>}

          {open.description && <p className="mt-6 leading-relaxed">{open.description}</p>}

          <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-muted">Relationship to property</dt><dd className="mt-1 font-semibold">{open.relationship}</dd></div>
            <div><dt className="text-muted">Owner ({open.owner.code})</dt><dd className="mt-1 font-semibold">{open.owner.name}</dd></div>
            <div><dt className="text-muted">WhatsApp</dt><dd className="mt-1 font-semibold">{open.owner.phone}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="mt-1 break-words font-semibold">{open.owner.email}</dd></div>
          </dl>

          <section className="mt-6 border-t border-line pt-6">
            <h3 className="text-lg font-bold">Agreement and fees the owner accepted</h3>
            <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Property listing fee</dt>
                <dd className="mt-1 break-words font-semibold">{naira(open.agreement.listingFee)} <span className="font-normal text-green">· Paid, reference {open.agreement.paymentRef}</span></dd>
              </div>
              <div>
                <dt className="text-muted">{open.purpose === "Rent" ? "Agency fee" : "Sale commission"}</dt>
                <dd className="mt-1 font-semibold">{open.agreement.feePct}% of the {open.purpose === "Rent" ? "annual rent" : "sale price"}</dd>
                <dd className="mt-1 text-muted">Not due yet. {open.agreement.feeDue}</dd>
              </div>
              <div><dt className="text-muted">Agreement accepted</dt><dd className="mt-1 font-semibold">{when(open.agreement.acceptedAt)} (version {open.agreement.version})</dd></div>
              <div><dt className="text-muted">Protection period</dt><dd className="mt-1 font-semibold">{open.agreement.protectionMonths} months from each introduction</dd></div>
            </dl>
          </section>

          {open.costs && <CostBreakdown costs={open.costs} note="As entered by the landlord. Check the figures before you publish." />}

          {(facts.length > 0 || open.video) && (
            <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
              {open.video?.startsWith("https://") && (
                <div>
                  <dt className="text-muted">Video</dt>
                  <dd className="mt-1 font-semibold">
                    <a href={open.video} target="_blank" rel="noreferrer" className="text-green underline underline-offset-4">Open the video</a>
                  </dd>
                </div>
              )}
            </dl>
          )}

          {answered.length > 0 && (
            <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {answered.map((f) => (
                <div key={f.id}>
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="mt-1 font-semibold">{formatDetail(f, open.details[f.id])}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 border-t border-line pt-6">
            {open.listingCode ? (
              <div>
                <p id="sub-approved" className="text-sm">
                  Approved. Property <strong>{open.listingCode}</strong> was created as a draft with this owner and agreement.{" "}
                  <Link href="/admin/properties" className="font-semibold text-green underline underline-offset-4">
                    Open Properties to finish and publish it
                  </Link>
                  .
                </p>
                {canApprove && (
                  <div id="sub-notify" className="mt-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
                    <h3 className="font-bold">Tell the owner</h3>
                    <p className="mt-1 text-sm text-muted">
                      Emails {open.owner.name} ({open.owner.email}) that the property was approved and is on the website, with a link to see it.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={pending || !open.listingPublished}
                        onClick={() =>
                          (!open.ownerEmailedAt || window.confirm(`The owner was already emailed on ${when(open.ownerEmailedAt)}. Send it again?`)) && run(() => sendApprovalEmail(open.dbId))
                        }
                        className={btnPrimary}
                      >
                        {pending ? "Sending…" : open.ownerEmailedAt ? "Send the approval email again" : "Send approval email to owner"}
                      </button>
                      {open.ownerEmailedAt && <span className="text-sm font-medium text-green">Sent on {when(open.ownerEmailedAt)}</span>}
                    </div>
                    {!open.listingPublished && (
                      <p className="mt-3 text-sm text-muted">Publish the property first (Properties, then tick Published). The email links to its page on the website.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {canApprove && open.status !== "Rejected" && (
                  <button type="button" disabled={pending} onClick={() => run(() => approveSubmission(open.dbId))} className={btnPrimary}>
                    {pending ? "Working…" : "Approve and create property"}
                  </button>
                )}
                {!settled && open.status !== "Contacted" && (
                  <button type="button" disabled={pending} onClick={() => run(() => setSubmissionStatus(open.dbId, "Contacted"))} className={btnGhost}>
                    Mark as contacted
                  </button>
                )}
                {canApprove && !settled && (
                  <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={`${btnGhost} text-red-700`}>
                    Reject
                  </button>
                )}
              </div>
            )}
            {!open.listingCode && open.status === "Rejected" && <RefundPanel s={open} canRefund={canRefund} pending={pending} run={run} />}
            {rejecting && (
              <RejectDialog
                code={open.id}
                ownerName={open.owner.name}
                fee={open.agreement.listingFee}
                canRefund={canRefund}
                pending={pending}
                onClose={() => setRejecting(false)}
                onReject={(reasonId, note, refund) => {
                  run(() => rejectSubmission(open.dbId, reasonId, note, refund));
                  setRejecting(false);
                }}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

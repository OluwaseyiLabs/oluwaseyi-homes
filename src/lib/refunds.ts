import { naira } from "./validation";

/**
 * Why a submission can be rejected. `refund` is what the Refund Policy says should happen: true = the listing fee is
 * given back, false = it is not, null = the person decides. `owner` is the sentence the owner reads, kept neutral.
 */
export const REJECT_REASONS = [
  { id: "declined", label: "We cannot list this property", refund: true, owner: "We are not able to list this property on our website." },
  { id: "changes", label: "It needs changes that cannot reasonably be made", refund: true, owner: "The listing would need changes that we could not reasonably ask you to make." },
  { id: "delay", label: "We could not publish it within 7 days (our side)", refund: true, owner: "We were not able to publish your property within the time we promised." },
  { id: "unverified", label: "The details or photos could not be verified", refund: false, owner: "We could not verify the details or photos that were sent." },
  { id: "duplicate", label: "It is a duplicate of a property already listed", refund: false, owner: "This property is already listed with us." },
  { id: "other", label: "Another reason (write it in the note)", refund: null, owner: "" },
] as const;
export type RejectReasonId = (typeof REJECT_REASONS)[number]["id"];
export const reasonById = (id: string) => REJECT_REASONS.find((r) => r.id === id);

export type RefundStatus = "Started" | "Refunded" | "Failed";
export interface RefundRecord {
  status: RefundStatus;
  method: "Paystack" | "Manual";
  amount: number;
  at: string;
  by: string;
  completedAt?: string;
  failure?: string;
  note?: string;
}

interface Who {
  name: string;
  code: string;
  property: string;
  fee: number;
}

/** The email an owner gets when their submission is rejected. It says why, and what happens to the listing fee. */
export function rejectionEmail(w: Who, reason: { owner: string }, note: string, refund: boolean, policyUrl: string) {
  return {
    subject: `About your property submission ${w.code}`,
    heading: "We could not list your property",
    paragraphs: [
      `Hello ${w.name}, thank you for sending us your property. We are sorry to tell you that we could not list it.`,
      [reason.owner, note].filter(Boolean).join(" "),
      refund
        ? `Your listing fee of ${naira(w.fee)} will be refunded in full to the card or account you paid with. It normally reaches you within 5 to 10 working days. We will email you again when the refund has started.`
        : `Under our Refund Policy, the listing fee of ${naira(w.fee)} is not refundable in this case. If you think this is a mistake, reply to this email or message us on WhatsApp.`,
    ].filter(Boolean),
    rows: [["Reference", w.code], ["Property", w.property], ["Listing fee", naira(w.fee)], ["Refund", refund ? "Yes, in full" : "No"]] as [string, string][],
    button: { label: "Read the Refund Policy", url: policyUrl },
  };
}

/** Sent when a refund is started later, as a separate step. */
export const refundStartedEmail = (w: Who) => ({
  subject: `Your refund has started: ${w.code}`,
  heading: "Your refund has started",
  paragraphs: [
    `Hello ${w.name}, we have started the refund of your listing fee of ${naira(w.fee)} for ${w.property}.`,
    "It goes back to the card or account you paid with, and normally reaches you within 5 to 10 working days. Your bank may take a little longer to show it.",
  ],
  rows: [["Reference", w.code], ["Amount", naira(w.fee)]] as [string, string][],
});

export const refundCompletedEmail = (w: Who, how: string) => ({
  subject: `Your refund is complete: ${w.code}`,
  heading: "Your refund is complete",
  paragraphs: [`Hello ${w.name}, the refund of your listing fee of ${naira(w.fee)} for ${w.property} is complete (${how}).`, "If you do not see it yet, your bank may need a few more days. Reply to this email or message us on WhatsApp if it does not arrive."],
  rows: [["Reference", w.code], ["Amount", naira(w.fee)]] as [string, string][],
});

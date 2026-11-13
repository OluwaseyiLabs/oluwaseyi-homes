/** Shapes and rules for leads, shared by the dashboard page and its server code. */

export const LEAD_STATUSES = [
  "New Enquiry",
  "Contact Released",
  "Inspection Scheduled",
  "Inspection Completed",
  "Negotiation",
  "Offer Accepted",
  "Successfully Rented",
  "Successfully Sold",
  "Unsuccessful",
  "Disputed",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

type Answer = "Yes" | "No";

/** One customer introduced to one owner about one property. Times are ISO strings. */
export interface Lead {
  dbId: string;
  /** The Lead ID, for example OHP-L-000012. */
  id: string;
  kind: "Rent" | "Buy";
  enquiryType: string;
  customer: { name: string; email: string; phone: string; emailVerified: boolean };
  listing?: { dbId: string; code: string; title: string; location: string };
  owner?: { code: string; name: string; email: string; whatsapp: string };
  source: string;
  introducedAt: string;
  releasedAt?: string;
  status: LeadStatus;
  customerAck?: string;
  ownerAck?: string;
  /** The owner's agreement as it stood when the property was linked. */
  agreement?: { version: string; acceptedAt?: string; listingFee?: number; feePct: number; feeDue: string; protectionMonths: number };
  followUps: { customerInspected?: Answer; ownerInspected?: Answer; customerCompleted?: Answer; ownerCompleted?: Answer };
  completion?: { date: string; price: number; evidence: string; verified: boolean };
  /** Worked out by the database from the final price and the agreed rate. */
  feeAmount?: number;
  invoice: "Not issued" | "Issued" | "Paid";
  receipt?: string;
  suspect?: string;
  /** What the customer asked for, and the time the team confirmed. */
  inspection?: { date?: string; slot?: string; confirmedFor?: string; confirmedBy?: string };
  conflict: boolean;
  /** How many follow-ups have been sent. */
  followUpCount: number;
  propertyType: string;
  location: string;
  budget: string;
  moveIn: string;
  facilities: string[];
  assistance: boolean;
  note: string;
  history: { at: string; by: string; what: string }[];
}

/** What is still missing before contact details may be released. Empty means ready. The database enforces the same list. */
export function releaseBlockers(l: Lead) {
  const out: string[] = [];
  if (!l.listing) out.push("No property is linked to this lead. Match the customer to a property.");
  if (!l.customer.emailVerified) out.push("The customer's email is not verified.");
  if (!l.customerAck) out.push("The customer has not acknowledged that the introduction comes from the platform.");
  if (l.listing && !l.agreement) out.push("The owner of this property has not accepted the Property Listing and Agency Agreement.");
  if (l.listing && !l.ownerAck) out.push("The owner has not acknowledged receiving this customer.");
  return out;
}

export const successStatus = (l: Lead): LeadStatus => (l.kind === "Rent" ? "Successfully Rented" : "Successfully Sold");

const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const moment = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** "Saturday 21 November 2026, morning" from the date and time of day a customer chose. */
export const inspectionText = (date?: string | null, slot?: string | null) =>
  date ? `${day.format(new Date(`${date}T00:00:00Z`))}${slot ? `, ${slot.toLowerCase()}` : ""}` : "";

/** "Saturday 21 November 2026 at 10:00" in Lagos time, from a confirmed moment. */
export const confirmedText = (iso: string) => moment.format(new Date(iso));

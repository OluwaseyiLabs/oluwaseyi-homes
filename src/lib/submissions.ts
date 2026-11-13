import type { Costs } from "./listings";

export const SUBMISSION_STATUSES = ["New", "Contacted", "Approved", "Rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** A property an owner sent in through the List Property form, with its paid listing fee and accepted agreement. */
export interface Submission {
  dbId: string;
  /** The reference the owner was given, for example OHP-S-000012. */
  id: string;
  purpose: "Rent" | "Sell";
  /** Rent: always the confirmed landlord. Sell: Owner or Middleman. */
  relationship: string;
  owner: { code: string; name: string; phone: string; email: string };
  propertyType: string;
  address: string;
  neighbourhood: string;
  bedrooms?: number;
  amount: number;
  description: string;
  /** Links that work for one hour: the photos are private. */
  photos: string[];
  /** Rent only: the charges the landlord entered. */
  costs?: Costs;
  serviceCovers: string;
  facilities: string[];
  parking: string;
  security: string;
  inspection: string;
  video?: string;
  /** The landlord's answers to the additional details, keyed by field id. */
  details: Record<string, string>;
  agreement: { version: string; acceptedAt: string; listingFee: number; feePct: number; feeDue: string; protectionMonths: number; paymentRef: string };
  /** The property created from this submission, once approved. */
  listingCode?: string;
  status: SubmissionStatus;
  unread: boolean;
  receivedAt: string;
}

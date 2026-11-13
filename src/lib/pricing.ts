import { naira } from "./validation";

/** Every fee the company charges. The live values are in the database (edited under Website content); these are the starting values. */
export interface Pricing {
  /** Paid by the owner, once per property, when they submit it. Naira. */
  listingFee: number;
  /** Rentals only. Percentage of the annual rent, paid by the landlord after a tenant is secured. */
  agencyFeePct: number;
  /** Sales and investments only. Percentage of the sale price, paid by the seller. */
  saleCommissionPct: number;
  /** Optional help for tenants. Naira, or null while the amount is not decided. */
  tenantAssistFee: number | null;
  /** Months after an introduction during which the fee is still owed if that customer takes the property. */
  protectionMonths: number;
  /** Version of the Property Listing and Agency Agreement. The database changes it whenever a fee changes. */
  agreementVersion: string;
}

export const defaultPricing: Pricing = {
  listingFee: 5_000,
  agencyFeePct: 10,
  saleCommissionPct: 10,
  tenantAssistFee: null,
  protectionMonths: 12,
  agreementVersion: "2026-11",
};

export const assistFeeLabel = (p: Pricing) => (p.tenantAssistFee === null ? "Fee to be confirmed" : naira(p.tenantAssistFee));

export interface Fee {
  id: "listing" | "agency" | "sale" | "assist";
  name: string;
  amount: string;
  payer: string;
  covers: string;
  due: string;
}

/** Who pays, what for, and when. Shown on the website and to the landlord before they submit. */
export const buildFees = (p: Pricing): Fee[] => [
  {
    id: "listing",
    name: "Property listing fee",
    amount: naira(p.listingFee),
    payer: "The landlord or owner listing the property",
    covers: "Reviewing your submission and publishing the property on the website. One fee per property.",
    due: "When you submit the property.",
  },
  {
    id: "agency",
    name: "Agency fee",
    amount: `${p.agencyFeePct}% of the annual rent`,
    payer: "The landlord, on rentals only",
    covers:
      "Finding and securing a tenant for your property. A fixed rate that does not change from one property to another. It is separate from the listing fee, and the tenant is not charged it.",
    due: "Only after a tenant we introduced has signed the tenancy agreement and paid the rent. Nothing is due if no tenant is secured.",
  },
  {
    id: "sale",
    name: "Sale commission",
    amount: `${p.saleCommissionPct}% of the sale price`,
    payer: "The seller, on sales and investment properties only",
    covers: "Finding a buyer and seeing the sale through.",
    due: "When the sale is completed.",
  },
  {
    id: "assist",
    name: "Tenant assistance service",
    amount: assistFeeLabel(p),
    payer: "The tenant, only if they choose it",
    covers:
      "Extra help finding a property, arranging inspections and going through the rental process. Browsing, enquiring and contacting owners stay free without it.",
    due: "Agreed with you before any work starts. You pay nothing unless you accept.",
  },
];

/** The fee an owner pays after a deal, for this kind of listing. */
export const dealFee = (p: Pricing, category: string) => buildFees(p).find((f) => f.id === (category === "Rent" ? "agency" : "sale"))!;

/** The fees an owner agrees to for this kind of listing. */
export const ownerFees = (p: Pricing, purpose: string) =>
  buildFees(p).filter((f) => f.id === "listing" || f.id === (purpose === "Rent" ? "agency" : "sale"));

/** The terms an owner accepts before a property is listed, beyond the fees themselves. */
export const agreementTerms = (p: Pricing) => [
  `Every customer we introduce to you is recorded with a Lead ID. If that customer rents or buys this property within ${p.protectionMonths} months of the introduction, the fee above is due, even if the deal is completed away from the platform.`,
  "You confirm each customer we introduce before we release contact details, and you tell us when the property is rented or sold.",
  "The fee is worked out from the final agreed rent or price, at the rate shown above.",
];

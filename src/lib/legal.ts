import type { Pricing } from "./pricing";

export const LEGAL_SLUGS = ["privacy", "terms", "refunds", "agreement"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export const isLegalSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);

export interface LegalPage {
  slug: LegalSlug;
  title: string;
  body: string;
  /** 0 while the starter text is showing. */
  version: number;
  updatedAt: string | null;
  updatedBy: string;
}

/** Words in {braces} are replaced when the page is shown, so fees and the company name stay right when they change. */
export const LEGAL_TOKENS: [token: string, meaning: string][] = [
  ["{company}", "the company name"],
  ["{whatsapp}", "the WhatsApp number"],
  ["{listingFee}", "the listing fee"],
  ["{agencyFeePct}", "the agency fee percentage"],
  ["{saleCommissionPct}", "the sale commission percentage"],
  ["{protectionMonths}", "the protection period in months"],
];

export function fillLegal(body: string, p: Pricing, site: { name: string; whatsappLabel: string }) {
  const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-US")}`;
  const values: Record<string, string> = {
    company: site.name,
    whatsapp: site.whatsappLabel,
    listingFee: naira(p.listingFee),
    agencyFeePct: `${p.agencyFeePct}%`,
    saleCommissionPct: `${p.saleCommissionPct}%`,
    protectionMonths: String(p.protectionMonths),
  };
  return body.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

export const LEGAL_LABELS: Record<LegalSlug, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Use",
  refunds: "Refund Policy",
  agreement: "Property Listing and Agency Agreement",
};

export type EnquiryKind = "Rent" | "Buy" | "Invest" | "List Property";

export interface Listing {
  /** The property's code, for example "P-0007". Enquiries refer to the property by this. */
  id: string;
  /** The database row id. Missing for the built-in fallback samples. */
  dbId?: string;
  /** A made-up example shown until real properties replace it. */
  sample?: boolean;
  /** Visible on the website. */
  published?: boolean;
  category: EnquiryKind;
  propertyType: string; // one of PROPERTY_TYPES in validation.ts
  title: string;
  location: string;
  price: string;
  beds?: number;
  baths?: number;
  size?: string;
  description: string;
  /** Values for the additional details defined in `detailFields`, keyed by field id. */
  details?: Record<string, string>;
  /** Rent listings: what the tenant pays to move in. */
  costs?: Costs;
  serviceCovers?: string;
  facilities?: string[];
  parking?: string;
  security?: string;
  /** When the property can be viewed. */
  inspection?: string;
  /** Link to a video tour. */
  video?: string;
  /** Set by the admin once the landlord and the property have been checked. */
  verified?: boolean;
  /** Admin only: who owns the property, once an owner has been added. */
  owner?: { id: string; code: string; name: string; whatsapp: string; email: string };
  /** Admin only: the owner's accepted agreement. */
  agreement?: {
    version: string;
    acceptedAt: string;
    /** How it was accepted. */
    via: "online form" | "recorded by team";
    recordedBy?: string;
    listingFee: number;
    feePct: number;
    feeDue: string;
    protectionMonths: number;
    paymentRef: string;
    proofNote?: string;
    proofPath?: string;
    /** A one-hour link to the proof the team uploaded. */
    proofUrl?: string;
  };
  /** Admin only: the stored path of each photo, in the same order as `images`. */
  imagePaths?: string[];
  images: string[]; // first image is the card cover; the rest show on hover and in the detail view
}

/** Amounts in naira. The caution deposit is a percentage of the annual rent. */
export interface Costs {
  rent: number;
  agencyFee: number;
  legalFee: number;
  cautionPct: number;
  serviceCharge: number;
}

/** The payment rows shown to a client, and what they add up to. */
export function moveInCost(c: Costs) {
  const caution = Math.round((c.rent * c.cautionPct) / 100);
  const rows: [string, number][] = [
    ["Annual rent", c.rent],
    ["Agency fee paid by tenant", c.agencyFee],
    ["Legal/agreement fee", c.legalFee],
    [c.cautionPct ? `Caution deposit (${c.cautionPct}% of rent)` : "Caution deposit", caution],
    ["Service charge", c.serviceCharge],
  ];
  return { rows, total: rows.reduce((t, [, v]) => t + v, 0) };
}

/** A stored photo path to something a browser can load. Paths starting with "/" are files shipped with the site. */
export const photoUrl = (path: string) =>
  path.startsWith("/") ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listings/${path}`;

/** "3 bedrooms · 3 bathrooms · 180 sqm", or nothing when none of those are known. */
export function specs(l: Listing) {
  return [
    l.beds ? `${l.beds} ${l.beds === 1 ? "bedroom" : "bedrooms"}` : null,
    l.baths ? `${l.baths} ${l.baths === 1 ? "bathroom" : "bathrooms"}` : null,
    l.size ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const DETAIL_TYPES = ["Text", "Number", "Dropdown", "Date", "Yes or no"] as const;
export type DetailType = (typeof DETAIL_TYPES)[number];

export const ASK_OWNER = ["No", "Rent", "Sell", "Both"] as const;
export type AskOwner = (typeof ASK_OWNER)[number];

/** An extra piece of information the admin has chosen to record for properties. */
export interface DetailField {
  id: string;
  label: string;
  type: DetailType;
  /** Choices, for a Dropdown. */
  options?: string[];
  /** Whether landlords are asked for this in the List Property form, and for which kind of listing. */
  askOwner: AskOwner;
}

/** Sample set. The admin creates, edits and removes these from the property editor. */
export const detailFields: DetailField[] = [
  { id: "minimum-rent-period", label: "Minimum rent period", type: "Dropdown", options: ["6 months", "1 year", "2 years"], askOwner: "Rent" },
  { id: "furnishing", label: "Furnishing", type: "Dropdown", options: ["Furnished", "Semi-furnished", "Unfurnished"], askOwner: "Both" },
  { id: "available-from", label: "Available from", type: "Date", askOwner: "Both" },
  { id: "pets", label: "Pets allowed", type: "Yes or no", askOwner: "Rent" },
  { id: "title-document", label: "Title document", type: "Dropdown", options: ["Certificate of Occupancy", "Governor's Consent", "Deed of Assignment", "Survey plan only"], askOwner: "Sell" },
];

/** The details a landlord is asked for when listing to rent or to sell. */
export const ownerFields = (fields: DetailField[], purpose: string) =>
  fields.filter((f) => f.askOwner === "Both" || f.askOwner === purpose);

/** Keeps only answers that belong to a known field and fit its type. */
export function cleanDetails(fields: DetailField[], raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of fields) {
    const v = (raw as Record<string, unknown>)[f.id];
    if (typeof v !== "string" || !v.trim()) continue;
    const value = v.trim().slice(0, 200);
    const choices = f.type === "Yes or no" ? ["Yes", "No"] : f.options;
    if (choices && !choices.includes(value)) continue;
    if (f.type === "Date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    out[f.id] = value;
  }
  return out;
}

/** How a stored value reads on the website. Dates are stored as YYYY-MM-DD. */
export function formatDetail(field: DetailField, value: string) {
  if (field.type !== "Date") return value;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The houses below are SAMPLES with made-up locations, prices and details.
 * They were loaded into the database once, and are also the fallback the
 * website shows if the database cannot be reached.
 */
export const tabs: EnquiryKind[] = ["Rent", "Buy", "Invest", "List Property"];

const H = "/images/hero.jpg";
const B = "/images/buy.jpg";
const S = "/images/sell.jpg";
const I = "/images/invest.jpg";

export const sampleListings: Listing[] = [
  {
    id: "rent-1",
    sample: true,
    details: { "minimum-rent-period": "1 year", furnishing: "Furnished", "available-from": "2026-12-01", pets: "No" },
    costs: { rent: 8_000_000, agencyFee: 0, legalFee: 400_000, cautionPct: 10, serviceCharge: 800_000 },
    serviceCovers: "Security, cleaning of shared areas, waste collection and generator fuel.",
    facilities: ["24-hour power", "Prepaid meter", "Borehole water", "Fitted kitchen", "Air conditioning", "Gated estate"],
    parking: "Two marked spaces inside the compound.",
    security: "Gated block with guards day and night, and CCTV at the gate.",
    inspection: "Monday to Saturday, 10am to 5pm, by appointment.",
    verified: true,
    category: "Rent",
    propertyType: "Apartment",
    title: "3-bedroom serviced apartment",
    location: "Lekki Phase 1, Lagos",
    price: "₦8,000,000",
    beds: 3,
    baths: 3,
    size: "180 sqm",
    description:
      "A serviced apartment in a gated block with 24-hour power, parking and security. Close to shops and the main road.",
    images: [B, H, S],
  },
  {
    id: "rent-2",
    sample: true,
    costs: { rent: 12_000_000, agencyFee: 0, legalFee: 600_000, cautionPct: 5, serviceCharge: 1_500_000 },
    serviceCovers: "Lift, cleaning, security and shared power.",
    facilities: ["24-hour power", "Air conditioning", "Generator", "Security guard", "CCTV"],
    parking: "Six spaces in the basement.",
    security: "Manned reception and access cards.",
    inspection: "Weekdays, 9am to 4pm.",
    verified: true,
    category: "Rent",
    propertyType: "Office",
    title: "Open-plan office space",
    location: "Victoria Island, Lagos",
    price: "₦12,000,000",
    size: "220 sqm",
    description:
      "A bright open-plan floor suited to a team of 20 to 30, with reception, meeting room and basement parking.",
    images: [H, I, B],
  },
  {
    id: "rent-3",
    sample: true,
    costs: { rent: 4_500_000, agencyFee: 0, legalFee: 225_000, cautionPct: 5, serviceCharge: 0 },
    facilities: ["Prepaid meter", "Borehole water"],
    parking: "Street parking in front of the shop.",
    security: "Shutter doors. Market security at night.",
    inspection: "Any day, 9am to 6pm.",
    category: "Rent",
    propertyType: "Shop",
    title: "Ground-floor retail shop",
    location: "Yaba, Lagos",
    price: "₦4,500,000",
    size: "60 sqm",
    description: "A street-facing shop with high foot traffic, shutter doors and a back store.",
    images: [S, B, H],
  },
  {
    id: "buy-1",
    sample: true,
    details: { furnishing: "Unfurnished", "available-from": "2027-01-15", "title-document": "Certificate of Occupancy" },
    facilities: ["Fitted kitchen", "Wardrobes", "Gated estate", "Boys' quarters"],
    parking: "Private driveway for three cars.",
    security: "Estate gate with guards.",
    inspection: "Any day, by appointment.",
    verified: true,
    category: "Buy",
    propertyType: "Duplex",
    title: "4-bedroom detached duplex",
    location: "Ajah, Lagos",
    price: "₦120,000,000",
    beds: 4,
    baths: 5,
    size: "420 sqm",
    description:
      "A detached duplex in a gated estate with a boys' quarters, fitted kitchen and a private driveway.",
    images: [B, H, I],
  },
  {
    id: "buy-2",
    sample: true,
    category: "Buy",
    propertyType: "Semi-detached",
    title: "3-bedroom semi-detached house",
    location: "Magodo, Lagos",
    price: "₦95,000,000",
    beds: 3,
    baths: 4,
    size: "300 sqm",
    description: "A well kept semi-detached home on a quiet street, close to schools and the express road.",
    images: [S, B, H],
  },
  {
    id: "buy-3",
    sample: true,
    category: "Buy",
    propertyType: "Land",
    title: "600 sqm residential plot",
    location: "Epe, Lagos",
    price: "₦18,000,000",
    size: "600 sqm",
    description: "A dry, fenced plot with a survey plan and registered title, ready for building.",
    images: [I, B, S],
  },
  {
    id: "invest-1",
    sample: true,
    category: "Invest",
    propertyType: "Land",
    title: "Estate plot, growth corridor",
    location: "Ibeju-Lekki, Lagos",
    price: "₦9,500,000",
    size: "450 sqm",
    description: "A plot in a planned estate along a growing corridor, with roads and drainage in place.",
    images: [I, H, S],
  },
  {
    id: "invest-2",
    sample: true,
    category: "Invest",
    propertyType: "Apartment",
    title: "Block of 6 rental flats",
    location: "Surulere, Lagos",
    price: "₦260,000,000",
    beds: 12,
    baths: 12,
    description: "A fully let block of six two-bedroom flats with steady rental income and its own power supply.",
    images: [B, I, H],
  },
  {
    id: "invest-3",
    sample: true,
    category: "Invest",
    propertyType: "Shop",
    title: "Commercial plaza unit",
    location: "Ikeja, Lagos",
    price: "₦45,000,000",
    size: "90 sqm",
    description: "A unit in a busy plaza with long-term tenants and strong demand for retail space.",
    images: [H, S, I],
  },
];

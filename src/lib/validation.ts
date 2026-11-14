// Mirrors the Lead API contract in workflows/oluwaseyi-homes-lead-api.md.

// "List Property" is not an enquiry: owners use the separate listing form.
export const ENQUIRY_TYPES = ["Rent", "Buy", "Invest"] as const;
export const PROPERTY_TYPES = [
  "Apartment",
  "Duplex",
  "Semi-detached",
  "Land",
  "Office",
  "Shop",
  "Others",
] as const;

/**
 * The facilities offered at the start. The live list is in the database (the admin can add more), and these are
 * what the website falls back to if the database cannot be reached.
 */
export const FACILITIES = [
  "24-hour power",
  "Prepaid meter",
  "Borehole water",
  "Fitted kitchen",
  "Wardrobes",
  "Air conditioning",
  "Generator",
  "Gated estate",
  "Parking space",
  "Security guard",
  "CCTV",
  "Boys' quarters",
] as const;

/** Caution deposit, as a share of the annual rent. */
export const CAUTION_RATES = ["5%", "6%", "7%", "8%", "9%", "10%"] as const;

/** "₦1,500,000" or "1500000" to 1500000. Anything without digits is 0. */
export const parseNaira = (v: string) => Number(v.replace(/\D/g, "")) || 0;
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-US")}`;

/**
 * A budget typed in any common way, shown as naira with commas: "1500000", "1,500,000", "N1.5m" and
 * "1.5 million" all become "₦1,500,000". Anything else (a range such as "1m to 2m", or words) is left as typed.
 */
export function formatBudget(text: string): string {
  const m = text.trim().match(/^[₦N]?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(m|mn|million|k|thousand)?\s*(?:naira|ngn)?$/i);
  if (!m) return text;
  const unit = (m[2] ?? "").toLowerCase();
  // A bare decimal such as "1.5" is ambiguous, so it is left alone.
  if (!unit && m[1].includes(".")) return text;
  let n = Number(m[1].replace(/[,\s]/g, ""));
  if (unit.startsWith("m")) n *= 1_000_000;
  else if (unit) n *= 1_000;
  return n >= 1 ? naira(n) : text;
}

/** Today in Lagos as YYYY-MM-DD. */
export const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
/** A date `n` days after a YYYY-MM-DD date. */
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Keeps only the facilities that are in `allowed`, as a comma-separated list in the order given. */
export const onlyFacilities = (csv: string, allowed: readonly string[]) =>
  csv.split(",").map((f) => f.trim()).filter((f, i, all) => allowed.includes(f) && all.indexOf(f) === i).join(",");

export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface LeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  enquiryType: string;
  propertyType: string;
  location: string;
  budget: string;
  /** YYYY-MM-DD. Asked for Rent and Buy. */
  moveInDate: string;
  /** YYYY-MM-DD. Optional: the day the customer would like to inspect the chosen property. */
  inspectionDate: string;
  /** One of INSPECTION_SLOTS. */
  inspectionSlot: string;
  /** Essential facilities, comma separated, each from FACILITIES. */
  facilities: string;
  /** "yes" when a tenant asks for the optional paid assistance service. */
  assistance: string;
  /** The property the customer asked about. Empty for a general enquiry. */
  listingId: string;
  /** Where the visitor came from, for example "instagram" or "Direct". */
  source: string;
  /** "yes" once the customer has acknowledged that the introduction comes from this platform. */
  acknowledged: string;
  specialRequirement: string;
}

/** Rent and Buy enquiries are matched to a property, so they need more detail than Invest. */
export const needsMatch = (enquiryType: string) => enquiryType === "Rent" || enquiryType === "Buy";

export type LeadErrors = Partial<Record<keyof LeadInput, string>>;

export interface ApiResponse<T = { message: string; reference?: string; step?: "code"; trackToken?: string }> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/** The times of day a customer can ask to inspect. */
export const INSPECTION_SLOTS = ["Morning", "Afternoon", "Evening"] as const;
/** How far ahead an inspection can be asked for. */
export const INSPECTION_DAYS = 60;

export const emptyLead: LeadInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  enquiryType: "",
  propertyType: "",
  location: "",
  budget: "",
  moveInDate: "",
  inspectionDate: "",
  inspectionSlot: "",
  facilities: "",
  assistance: "",
  listingId: "",
  source: "",
  acknowledged: "",
  specialRequirement: "",
};

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isPhone = (v: string) =>
  /^\d{7,20}$/.test(v.replace(/[\s()+-]/g, "")) && !/[^\d\s()+-]/.test(v);

export function validateLead(input: LeadInput): LeadErrors {
  const errors: LeadErrors = {};
  if (!input.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!input.lastName.trim()) errors.lastName = "Enter your last name.";
  if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
  if (!isPhone(input.phone)) errors.phone = "Enter a phone number with 7 to 20 digits.";
  if (!(ENQUIRY_TYPES as readonly string[]).includes(input.enquiryType))
    errors.enquiryType = "Choose what you are looking for.";
  if (!(PROPERTY_TYPES as readonly string[]).includes(input.propertyType))
    errors.propertyType = "Choose a property type.";
  if (needsMatch(input.enquiryType)) {
    if (!input.location.trim()) errors.location = "Enter the area you prefer.";
    if (!input.budget.trim()) errors.budget = "Enter your budget.";
  }
  if (input.acknowledged !== "yes") errors.acknowledged = "Tick the box to continue.";
  if (input.moveInDate && !isDate(input.moveInDate)) errors.moveInDate = "Choose a date.";
  if (input.inspectionDate) {
    const today = lagosToday();
    if (!isDate(input.inspectionDate) || input.inspectionDate < today) errors.inspectionDate = "Choose a date that has not passed.";
    else if (input.inspectionDate > addDays(today, INSPECTION_DAYS)) errors.inspectionDate = `Choose a date within the next ${INSPECTION_DAYS} days.`;
    if (!(INSPECTION_SLOTS as readonly string[]).includes(input.inspectionSlot)) errors.inspectionSlot = "Choose a time of day.";
  }
  return errors;
}

// ---- Owner listing submissions (List Property tab) ----

export const LISTING_PURPOSES = ["Rent", "Sell"] as const;
export type ListingPurpose = (typeof LISTING_PURPOSES)[number];

export const RELATIONSHIPS = ["Owner", "Middleman"] as const;

export const MAX_IMAGES = 8;
/** Vercel rejects request bodies over 4.5 MB, so photos are compressed in the browser to fit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface ListingInput {
  purpose: string;
  fullName: string;
  phone: string;
  email: string;
  propertyType: string;
  address: string;
  neighbourhood: string;
  bedrooms: string;
  /** Annual rent, or the asking price for a sale. */
  askingAmount: string;
  // Rent only: what the tenant pays on top of the rent.
  legalFee: string;
  /** One of CAUTION_RATES, or empty for no caution deposit. */
  cautionRate: string;
  serviceCharge: string;
  serviceCovers: string;
  /** Comma separated, each from FACILITIES. */
  facilities: string;
  parking: string;
  security: string;
  inspection: string;
  videoLink: string;
  description: string;
  /** "yes" once a landlord listing to rent has confirmed ownership. */
  ownerConfirmed: string;
  /** For listings to sell: how the person relates to the property. */
  relationship: string;
  /** "yes" once the owner has accepted the Property Listing and Agency Agreement, fees included. */
  feesAccepted: string;
}

/** Fields that only apply to a listing to rent. */
export const RENT_AMOUNTS = ["legalFee", "serviceCharge"] as const;
export const RENT_ONLY = [...RENT_AMOUNTS, "cautionRate", "serviceCovers"] as const;

export type ListingErrors = Partial<Record<keyof ListingInput | "images", string>>;

export const emptyListing: ListingInput = {
  purpose: "Rent",
  fullName: "",
  phone: "",
  email: "",
  propertyType: "",
  address: "",
  neighbourhood: "",
  bedrooms: "",
  askingAmount: "",
  legalFee: "",
  cautionRate: "",
  serviceCharge: "",
  serviceCovers: "",
  facilities: "",
  parking: "",
  security: "",
  inspection: "",
  videoLink: "",
  description: "",
  ownerConfirmed: "",
  relationship: "",
  feesAccepted: "",
};

export function validateListing(
  input: ListingInput,
  images: { count: number; bytes: number },
): ListingErrors {
  const errors: ListingErrors = {};
  if (!(LISTING_PURPOSES as readonly string[]).includes(input.purpose))
    errors.purpose = "Choose to rent out or to sell.";
  if (!input.fullName.trim()) errors.fullName = "Enter your name.";
  if (!isPhone(input.phone)) errors.phone = "Enter a phone number with 7 to 20 digits.";
  if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
  if (input.purpose === "Rent" && input.ownerConfirmed !== "yes")
    errors.ownerConfirmed = "Confirm that you are the landlord or owner.";
  if (input.purpose === "Sell" && !(RELATIONSHIPS as readonly string[]).includes(input.relationship))
    errors.relationship = "Choose how you are related to this property.";
  if (!(PROPERTY_TYPES as readonly string[]).includes(input.propertyType))
    errors.propertyType = "Choose a property type.";
  if (!input.address.trim()) errors.address = "Enter the property address.";
  if (!input.neighbourhood.trim()) errors.neighbourhood = "Enter the area or neighbourhood.";
  if (input.bedrooms && !/^\d{1,2}$/.test(input.bedrooms)) errors.bedrooms = "Enter a number.";
  if (!parseNaira(input.askingAmount))
    errors.askingAmount =
      input.purpose === "Rent" ? "Enter the annual rent in naira." : "Enter the asking price in naira.";
  if (input.purpose === "Rent") {
    for (const key of RENT_AMOUNTS)
      if (input[key].trim() && !/\d/.test(input[key])) errors[key] = "Enter an amount in naira, or leave it empty.";
    if (input.cautionRate && !(CAUTION_RATES as readonly string[]).includes(input.cautionRate))
      errors.cautionRate = "Choose a caution deposit from the list.";
  }
  if (input.feesAccepted !== "yes") errors.feesAccepted = "Tick the box to accept the agreement.";
  if (input.videoLink && !/^https:\/\/\S+\.\S+$/.test(input.videoLink))
    errors.videoLink = "Enter a full link that starts with https://";
  if (images.count < 1) errors.images = "Add at least one photo of the property.";
  else if (images.count > MAX_IMAGES) errors.images = `Add up to ${MAX_IMAGES} photos.`;
  else if (images.bytes > MAX_UPLOAD_BYTES)
    errors.images = "The photos are too large together. Remove one or two and try again.";
  return errors;
}

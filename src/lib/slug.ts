import type { Listing } from "./listings";

const kebab = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A readable address for a property that ends with its code, for example `3-bedroom-flat-yaba-lagos-p-0004`. */
export const propertySlug = (l: Pick<Listing, "id" | "title" | "location">) =>
  `${kebab(`${l.title} ${l.location}`).slice(0, 70).replace(/-$/, "")}-${kebab(l.id)}`;

/** The code at the end of an address, lower case, for example `p-0004`. Only this part is used to find the property. */
export const codeFromSlug = (slug: string) => slug.toLowerCase().match(/([a-z]+-\d+)$/)?.[1] ?? "";

export const propertyPath = (l: Pick<Listing, "id" | "title" | "location">) => `/properties/${propertySlug(l)}`;

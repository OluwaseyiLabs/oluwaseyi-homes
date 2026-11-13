import type { Listing } from "./listings";
import { parseNaira } from "./validation";

/** What a visitor has chosen to narrow the properties by. Empty values mean "any". */
export interface Filters {
  q: string;
  min: string;
  max: string;
  /** Minimum number of bedrooms, as text: "", "1", "2", "3", "4". */
  beds: string;
  type: string;
  facs: string[];
  sort: "new" | "low" | "high";
}

export const noFilters: Filters = { q: "", min: "", max: "", beds: "", type: "", facs: [], sort: "new" };

export const isFiltered = (f: Filters) => JSON.stringify({ ...f, sort: "new" }) !== JSON.stringify(noFilters);

const priceOf = (l: Listing) => parseNaira(l.price);

/** The properties that match, in the chosen order. "new" keeps the order they came in (newest first). */
export function applyFilters(list: Listing[], f: Filters): Listing[] {
  const min = parseNaira(f.min);
  const max = parseNaira(f.max);
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const beds = Number(f.beds) || 0;
  const out = list.filter((l) => {
    if (words.length) {
      const text = [l.title, l.location, l.description, l.propertyType, ...(l.facilities ?? [])].join(" ").toLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
    }
    if (min && priceOf(l) < min) return false;
    if (max && priceOf(l) > max) return false;
    if (beds && (l.beds ?? 0) < beds) return false;
    if (f.type && l.propertyType !== f.type) return false;
    if (f.facs.length) {
      const has = (l.facilities ?? []).map((x) => x.toLowerCase());
      if (!f.facs.every((x) => has.includes(x.toLowerCase()))) return false;
    }
    return true;
  });
  if (f.sort === "low") out.sort((a, b) => priceOf(a) - priceOf(b));
  if (f.sort === "high") out.sort((a, b) => priceOf(b) - priceOf(a));
  return out;
}

/** The choices as a web address query, so a filtered view can be shared. Only what differs from "any" is written. */
export function filtersToQuery(f: Filters, tab: string): string {
  const p = new URLSearchParams();
  if (tab && tab !== "Rent") p.set("tab", tab);
  if (f.q) p.set("q", f.q);
  if (f.min) p.set("min", f.min);
  if (f.max) p.set("max", f.max);
  if (f.beds) p.set("beds", f.beds);
  if (f.type) p.set("type", f.type);
  if (f.facs.length) p.set("f", f.facs.join("|"));
  if (f.sort !== "new") p.set("sort", f.sort);
  return p.toString();
}

export function filtersFromQuery(search: string): { tab: string; filters: Filters } {
  const p = new URLSearchParams(search);
  const sort = p.get("sort");
  return {
    tab: p.get("tab") ?? "Rent",
    filters: {
      q: (p.get("q") ?? "").slice(0, 100),
      min: (p.get("min") ?? "").replace(/\D/g, "").slice(0, 12),
      max: (p.get("max") ?? "").replace(/\D/g, "").slice(0, 12),
      beds: ["1", "2", "3", "4"].includes(p.get("beds") ?? "") ? (p.get("beds") as string) : "",
      type: p.get("type") ?? "",
      facs: (p.get("f") ?? "").split("|").filter(Boolean).slice(0, 12),
      sort: sort === "low" || sort === "high" ? sort : "new",
    },
  };
}

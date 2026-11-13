"use client";

import type { Filters } from "@/lib/filters";
import { noFilters } from "@/lib/filters";
import { PROPERTY_TYPES } from "@/lib/validation";

const box =
  "mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none sm:text-sm transition focus:border-green focus:ring-2 focus:ring-green/20";

/** Search and filter controls above the property list. Everything here only changes what is shown; nothing is sent anywhere. */
export function PropertyFilters({
  value,
  onChange,
  facilities,
  total,
  shown,
  rent,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  facilities: string[];
  total: number;
  shown: number;
  /** Rentals are priced per year, so the price boxes say so. */
  rent: boolean;
}) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) => onChange({ ...value, [key]: v });
  const active = JSON.stringify({ ...value, sort: "new" }) !== JSON.stringify(noFilters);
  const money = (s: string) => (s ? Number(s).toLocaleString("en-NG") : "");

  return (
    <div className="mt-8 rounded-3xl border border-line bg-surface p-4 sm:p-5" role="search" aria-label="Search properties">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="text-xs font-semibold text-muted sm:col-span-2 lg:col-span-1">
          Search
          <input id="f-q" type="search" value={value.q} onChange={(e) => set("q", e.target.value)} placeholder="Area, street or keyword" className={box} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Property type
          <select id="f-type" value={value.type} onChange={(e) => set("type", e.target.value)} className={box}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Bedrooms
          <select id="f-beds" value={value.beds} onChange={(e) => set("beds", e.target.value)} className={box}>
            <option value="">Any</option>
            {["1", "2", "3", "4"].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Sort by
          <select id="f-sort" value={value.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className={box}>
            <option value="new">Newest</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
        <label className="text-xs font-semibold text-muted">
          {rent ? "Lowest rent a year (₦)" : "Lowest price (₦)"}
          <input id="f-min" inputMode="numeric" value={money(value.min)} onChange={(e) => set("min", e.target.value.replace(/\D/g, ""))} placeholder="No minimum" className={box} />
        </label>
        <label className="text-xs font-semibold text-muted">
          {rent ? "Highest rent a year (₦)" : "Highest price (₦)"}
          <input id="f-max" inputMode="numeric" value={money(value.max)} onChange={(e) => set("max", e.target.value.replace(/\D/g, ""))} placeholder="No maximum" className={box} />
        </label>
        {facilities.length > 0 && (
          <details className="group rounded-xl border border-line px-3 sm:col-span-2 lg:col-span-1" open={value.facs.length > 0}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold">
              <span>
                Facilities{value.facs.length > 0 && <span className="ml-2 rounded-full bg-green px-2 py-0.5 text-xs text-white">{value.facs.length}</span>}
              </span>
              <span aria-hidden className="text-muted transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="flex flex-wrap gap-2 pb-3">
              {facilities.map((f, i) => (
                <label key={f} htmlFor={`f-fac-${i}`} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-sm has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:checked]:text-green has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green/30">
                  <input
                    id={`f-fac-${i}`}
                    type="checkbox"
                    checked={value.facs.includes(f)}
                    onChange={(e) => set("facs", e.target.checked ? [...value.facs, f] : value.facs.filter((x) => x !== f))}
                    className="size-4 accent-green"
                  />
                  {f}
                </label>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p id="f-count" role="status" className="text-sm text-muted">
          {active ? `${shown} of ${total} ${total === 1 ? "property" : "properties"} match` : `${total} ${total === 1 ? "property" : "properties"}`}
        </p>
        {active && (
          <button type="button" id="f-clear" onClick={() => onChange({ ...noFilters, sort: value.sort })} className="min-h-11 text-sm font-semibold text-green underline underline-offset-4">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

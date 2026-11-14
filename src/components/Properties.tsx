"use client";

import { useEffect, useMemo, useState } from "react";
import { applyFilters, filtersFromQuery, filtersToQuery, noFilters, type Filters } from "@/lib/filters";
import { tabs, type DetailField, type EnquiryKind, type Listing } from "@/lib/listings";
import { ListingCard } from "./ListingCard";
import { ListingDetail } from "./ListingDetail";
import { ListPropertyForm } from "./ListPropertyForm";
import { PropertyFilters } from "./PropertyFilters";
import { useSite } from "./SiteProvider";

const PAGE = 12;

export function Properties({ listings, detailFields, facilities }: { listings: Listing[]; detailFields: DetailField[]; facilities: string[] }) {
  const { content } = useSite();
  const [active, setActive] = useState<EnquiryKind>("Rent");
  const [open, setOpen] = useState<Listing | null>(null);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [limit, setLimit] = useState(PAGE);
  const [ready, setReady] = useState(false);

  // A shared link such as /?tab=Buy&beds=3&max=100000000 opens with those choices already made.
  useEffect(() => {
    const { tab, filters: f } = filtersFromQuery(window.location.search);
    if ((tabs as string[]).includes(tab)) setActive(tab as EnquiryKind);
    setFilters(f);
    setReady(true);
  }, []);
  // The choices are kept in the address, so the view can be shared. Nothing is stored anywhere else.
  useEffect(() => {
    if (!ready) return;
    const q = filtersToQuery(filters, active);
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
  }, [filters, active, ready]);
  useEffect(() => setLimit(PAGE), [filters, active]);

  const ofTab = useMemo(() => listings.filter((l) => l.category === active), [listings, active]);
  const matching = useMemo(() => applyFilters(ofTab, filters), [ofTab, filters]);
  const shown = matching.slice(0, limit);

  return (
    <section id="properties" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-20 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">
          {content.propertiesHeading}
        </h2>
        <div role="tablist" aria-label="Property category" className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain sm:gap-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              type="button"
              aria-selected={t === active}
              aria-controls="listing-panel"
              onClick={() => {
                setActive(t);
                // Prices and bedrooms mean different things on each tab, so each tab starts with no filters.
                setFilters(noFilters);
              }}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold transition active:scale-[0.97] min-[360px]:px-3.5 sm:px-5 ${
                t === active ? "bg-ink text-ground" : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {active !== "List Property" && ofTab.length > 0 && (
        <PropertyFilters value={filters} onChange={setFilters} facilities={facilities} total={ofTab.length} shown={matching.length} rent={active === "Rent"} />
      )}

      <div
        key={active}
        id="listing-panel"
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.map((l, i) => (
          <ListingCard key={l.id} listing={l} index={i} onOpen={setOpen} />
        ))}
        {active !== "List Property" && ofTab.length === 0 && (
          <p className="text-lg text-muted sm:col-span-2 lg:col-span-3">
            Nothing is listed here right now. Send an enquiry and we will tell you when something comes up.
          </p>
        )}
        {active !== "List Property" && ofTab.length > 0 && matching.length === 0 && (
          <div id="no-match" className="rounded-3xl border border-line bg-surface p-8 sm:col-span-2 lg:col-span-3">
            <p className="text-lg font-semibold">No property matches those choices.</p>
            <p className="mt-1 text-muted">Try a wider price range or fewer filters, or send an enquiry and tell us what you need.</p>
            <button type="button" onClick={() => setFilters({ ...noFilters, sort: filters.sort })} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 text-sm font-semibold transition hover:border-ink">
              Clear filters
            </button>
          </div>
        )}
        {active === "List Property" && (
          <div className="animate-[rise_0.5s_ease-out_both] rounded-3xl border border-line bg-surface p-8 motion-reduce:animate-none sm:col-span-2 sm:p-12 lg:col-span-3">
            <h3 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {content.listHeading}
            </h3>
            <p className="mt-3 max-w-xl text-lg text-muted">
              {content.listText}
            </p>
            <ListPropertyForm detailFields={detailFields} facilities={facilities} />
          </div>
        )}
      </div>

      {active !== "List Property" && matching.length > shown.length && (
        <div className="mt-8 text-center">
          <button type="button" id="show-more" onClick={() => setLimit((n) => n + PAGE)} className="inline-flex min-h-12 items-center rounded-full border border-ink/20 px-8 font-semibold transition hover:border-ink active:scale-[0.97]">
            Show more ({matching.length - shown.length} more)
          </button>
        </div>
      )}

      {open && <ListingDetail listing={open} detailFields={detailFields} onClose={() => setOpen(null)} />}
    </section>
  );
}

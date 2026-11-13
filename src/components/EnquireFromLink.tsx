"use client";

import { useEffect } from "react";
import type { Listing } from "@/lib/listings";
import { presetEnquiry } from "@/lib/scroll";

/** A link such as /?enquire=P-0004 opens the enquiry form already filled in for that property. */
export function EnquireFromLink({ listings }: { listings: Listing[] }) {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("enquire");
    const l = code ? listings.find((x) => x.id.toLowerCase() === code.toLowerCase()) : undefined;
    if (!l) return;
    // Give the form a moment to be ready, then fill it in and scroll to it.
    const t = window.setTimeout(() => {
      presetEnquiry({
        enquiryType: l.category,
        propertyType: l.propertyType,
        location: l.location,
        budget: l.price,
        facilities: (l.facilities ?? []).join(","),
        listingId: l.id,
        note: `Interested in: ${l.title}, ${l.location} (${l.price}${l.category === "Rent" ? " / year" : ""}).`,
      });
      window.history.replaceState(null, "", window.location.pathname);
    }, 400);
    return () => window.clearTimeout(t);
  }, [listings]);
  return null;
}

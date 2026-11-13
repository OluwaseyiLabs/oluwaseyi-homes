"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const ENQUIRY_PRESET = "enquiry:preset";

/** What a property passes to the enquiry form, so the customer does not retype what is already known. */
export interface EnquiryPreset {
  enquiryType: string;
  propertyType?: string;
  location?: string;
  /** The property's rent or price. */
  budget?: string;
  /** The property's facilities, joined by commas. */
  facilities?: string;
  note?: string;
  listingId?: string;
}

/** Fills in the enquiry form and scrolls to it. */
export function presetEnquiry(detail: EnquiryPreset) {
  window.dispatchEvent(new CustomEvent(ENQUIRY_PRESET, { detail }));
  document.getElementById("enquiry-form")?.scrollIntoView({ behavior: "smooth" });
}

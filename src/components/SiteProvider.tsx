"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Pricing } from "@/lib/pricing";
import type { SiteContent } from "@/lib/site-content";

export interface SiteValue extends SiteContent {
  pricing: Pricing;
}

const Ctx = createContext<SiteValue | null>(null);

/** Gives the client components the company details, wording and fees that were loaded on the server. */
export function SiteProvider({ value, children }: { value: SiteValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite must be used inside a SiteProvider");
  return v;
}

"use server";

import { allow, clientKey } from "@/lib/ratelimit";
import { cleanEmail, cleanText } from "@/lib/sanitize";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EnquiryProgress } from "@/lib/track";

export interface LookupState {
  error: string;
  progress: EnquiryProgress | null;
}

/** Looks up an enquiry by its reference and the email used. Any mismatch gets the same answer, so nothing can be guessed. */
export async function lookupEnquiry(_: LookupState, form: FormData): Promise<LookupState> {
  const code = cleanText(String(form.get("code") ?? ""), 30);
  const email = cleanEmail(String(form.get("email") ?? ""));
  if (!code || !email) return { error: "Enter your reference and the email you used.", progress: null };

  // At most 8 tries in 10 minutes from one address.
  if (!(await allow(`track-ip:${await clientKey()}`, 8, 600))) return { error: "Too many tries. Please wait a few minutes and try again.", progress: null };

  const { data } = await supabaseAdmin().rpc("track_lead_by_code", { p_code: code, p_email: email });
  return data ? { error: "", progress: data as EnquiryProgress } : { error: "We could not find an enquiry with that reference and email. Check both and try again.", progress: null };
}

import "server-only";
import { supabaseAdmin } from "./supabase/admin";

export interface StoredError {
  ref: string;
  place: string;
  message: string;
  detail: Record<string, unknown>;
  staged?: boolean;
}

// A ceiling per server instance, so a flood of failing requests cannot fill the table.
let windowStart = 0;
let inWindow = 0;
const PER_MINUTE = 60;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/**
 * Saves an error where the team can read it in the dashboard. It never throws and never slows the page down: if the
 * table is missing or the database is down, the error is still in the host's logs, which is where it started.
 */
export function storeError(e: StoredError) {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; inWindow = 0; }
  if (++inWindow > PER_MINUTE) return;
  const job = Promise.resolve(
    supabaseAdmin()
      .from("error_log")
      .insert({ ref: clip(e.ref, 40), place: clip(e.place, 120), message: clip(e.message, 500), detail: e.detail, staged: !!e.staged })
      .then(() => undefined, () => undefined),
  ).catch(() => undefined);
  // On Vercel the function can be frozen the moment the response is sent; `after` keeps it alive until this is saved.
  import("next/server").then(({ after }) => { try { after(job); } catch { /* outside a request: it just runs */ } }).catch(() => undefined);
}

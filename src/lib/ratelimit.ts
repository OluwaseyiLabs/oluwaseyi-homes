import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { logError } from "./errors";
import { supabaseAdmin } from "./supabase/admin";

/** The caller's address, or "unknown". Only a salted hash of it is ever stored. */
export async function clientKey(extra = "") {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.TRACK_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "salt";
  return createHash("sha256").update(`${salt}|${ip}|${extra}`).digest("hex").slice(0, 32);
}

/** True when the caller may go ahead: fewer than `max` hits for `bucket` within `seconds`. Counts this hit. Lets people through if the database is down. */
export async function allow(bucket: string, max: number, seconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("hit_rate_limit", { p_key: bucket, p_max: max, p_seconds: seconds });
  if (error) {
    logError("ratelimit", error, { bucket: bucket.split(":")[0] });
    return true;
  }
  return data === true;
}

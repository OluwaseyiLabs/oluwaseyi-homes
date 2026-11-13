import { createHash } from "node:crypto";
import { allow, clientIp, clientKey } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TRACK_EVENTS, classifyDevice, classifySource, isBot } from "@/lib/track";

const answer = () => new Response(null, { status: 204 });
const recent = new Map<string, number[]>();

/**
 * Counts a visit or a button click. It stores the page, where the visitor came from, the kind of device and a
 * visitor mark that changes every day, so nobody can be followed from one day to the next. No IP address is
 * stored and no cookie is set. It always answers 204, so it can never reveal anything.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ua = req.headers.get("user-agent") ?? "";
  if (!body || isBot(ua)) return answer();

  const path = typeof body.path === "string" ? body.path.split(/[?#]/)[0].slice(0, 200) : "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/r/") || path.startsWith("/track")) return answer();
  const event = typeof body.event === "string" ? body.event : null;
  if (event !== null && !(event in TRACK_EVENTS)) return answer();

  // The visitor mark: a hash of the day, the address and the browser. Only the hash is kept.
  const ip = clientIp(req.headers);
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.TRACK_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "salt";
  const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 20);

  // At most 120 reports a minute from one visitor (best effort; each server instance keeps its own count).
  const now = Date.now();
  const hits = (recent.get(visitor) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 120) return answer();
  recent.set(visitor, [...hits, now]);
  if (recent.size > 5000) recent.clear();

  // A ceiling per address that survives restarts and works across servers, so nobody can fill the table by changing browser names.
  if (!(await allow(`track-ip:${await clientKey()}`, 400, 3600))) return answer();

  const host = req.headers.get("host") ?? "";
  await supabaseAdmin().from("page_views").insert({
    path,
    event,
    visitor,
    device: classifyDevice(ua),
    source: classifySource(String(body.referrer ?? "").slice(0, 500), String(body.utm ?? "").slice(0, 60), host),
  });
  return answer();
}

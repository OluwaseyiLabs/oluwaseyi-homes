import "server-only";

/**
 * Turnstile (Cloudflare's free CAPTCHA). It switches on only when BOTH keys are set. With just the secret key the form
 * could never produce a token and every enquiry would be refused, so that half-configured state keeps it off instead.
 */
export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export type TurnstileResult = "ok" | "failed" | "unreachable";

/**
 * Asks Cloudflare whether a token from the widget is genuine. A token works once and expires after a few minutes,
 * so a bot cannot collect tokens and reuse them. The `action` must be the one the widget was drawn with.
 */
export async function verifyTurnstile(token: string, action: string, ip?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "ok";
  // Real tokens are a few hundred characters; anything absurd is refused before Cloudflare is asked.
  if (!token || token.length > 2048) return "failed";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return "unreachable";
    const json = (await res.json().catch(() => null)) as { success?: boolean; action?: string } | null;
    if (!json?.success) return "failed";
    // A token drawn for another form on this site must not unlock this one.
    return !json.action || json.action === action ? "ok" : "failed";
  } catch {
    return "unreachable";
  }
}

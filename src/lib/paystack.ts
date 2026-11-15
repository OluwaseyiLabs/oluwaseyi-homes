import "server-only";

/** Server-only: confirms with Paystack that a payment succeeded for at least `naira` naira. */
export async function verifyPayment(
  reference: string,
  naira: number,
): Promise<"paid" | "unpaid" | "not-configured" | "unreachable"> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return "not-configured";
  if (!/^[\w.=-]{6,100}$/.test(reference)) return "unpaid";
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as {
      data?: { status?: string; amount?: number; currency?: string };
    } | null;
    const d = json?.data;
    // Paystack reports amounts in kobo.
    return d?.status === "success" && d.currency === "NGN" && (d.amount ?? 0) >= naira * 100 ? "paid" : "unpaid";
  } catch {
    return "unreachable";
  }
}

/**
 * Server-only: finds a successful payment whose reference starts with `prefix` (every invoice for one lead does, and
 * sending an invoice again makes a new reference, so the one that was paid may not be the one on file). Looks at
 * Paystack's most recent successful payments.
 */
export async function findPaidByPrefix(prefix: string, naira: number): Promise<{ reference: string } | { short: number } | null | "unreachable"> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !/^[\w-]{4,60}$/.test(prefix)) return null;
  try {
    const res = await fetch(`https://api.paystack.co/transaction?status=success&perPage=100`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { data?: { reference?: string; amount?: number; currency?: string }[] } | null;
    const mine = (json?.data ?? []).filter((t) => t.reference?.startsWith(prefix) && t.currency === "NGN");
    const full = mine.find((t) => (t.amount ?? 0) >= naira * 100);
    if (full?.reference) return { reference: full.reference };
    const best = Math.max(0, ...mine.map((t) => t.amount ?? 0));
    return best > 0 ? { short: best / 100 } : null;
  } catch {
    return "unreachable";
  }
}

/** Server-only: starts a Paystack payment and returns the page where it can be paid, or null if Paystack refused. */
export async function startPayment(email: string, naira: number, reference: string): Promise<string | null> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: Math.round(naira * 100), currency: "NGN", reference }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { data?: { authorization_url?: string } } | null;
    return json?.data?.authorization_url ?? null;
  } catch {
    return null;
  }
}

/** The Paystack address. Only a developer's own machine may point it somewhere else (a test stand-in); the real site never does. */
const paystackBase = () => (process.env.NODE_ENV !== "production" && process.env.PAYSTACK_API_URL ? process.env.PAYSTACK_API_URL : "https://api.paystack.co").replace(/\/$/, "");

export type RefundState = "pending" | "processing" | "processed" | "failed" | "needs-attention";
export type RefundStart = { ok: true; id: string; state: RefundState } | { ok: false; message: string; unreachable?: boolean };

/**
 * Server-only: asks Paystack to give the listing fee back to the card or account it was paid with. The amount is
 * always the full fee. Paystack queues the refund, so "ok" means it was accepted, not that the money has arrived.
 */
export async function refundPayment(reference: string, naira: number, notes: { merchant: string; customer: string }): Promise<RefundStart> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return { ok: false, message: "Paystack is not set up on this server." };
  if (!/^[\w.=-]{6,100}$/.test(reference)) return { ok: false, message: "That payment reference is not valid." };
  try {
    const res = await fetch(`${paystackBase()}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: reference, amount: Math.round(naira * 100), currency: "NGN", merchant_note: notes.merchant.slice(0, 250), customer_note: notes.customer.slice(0, 250) }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: { id?: number | string; status?: string } } | null;
    if (!res.ok || !json?.status) return { ok: false, message: json?.message || `Paystack answered ${res.status}.` };
    return { ok: true, id: String(json.data?.id ?? ""), state: (json.data?.status as RefundState) ?? "pending" };
  } catch {
    return { ok: false, message: "Paystack could not be reached just now.", unreachable: true };
  }
}

/** Server-only: where the refund of one payment has got to, from Paystack's list of refunds for that payment. */
export async function refundStatus(reference: string): Promise<{ ok: true; state: RefundState } | { ok: false; message: string }> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return { ok: false, message: "Paystack is not set up on this server." };
  if (!/^[\w.=-]{6,100}$/.test(reference)) return { ok: false, message: "That payment reference is not valid." };
  try {
    const res = await fetch(`${paystackBase()}/refund?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: { status?: string }[] } | null;
    if (!res.ok || !json?.status) return { ok: false, message: json?.message || `Paystack answered ${res.status}.` };
    const latest = json.data?.[0];
    return latest?.status ? { ok: true, state: latest.status as RefundState } : { ok: false, message: "Paystack has no refund for this payment yet." };
  } catch {
    return { ok: false, message: "Paystack could not be reached just now." };
  }
}

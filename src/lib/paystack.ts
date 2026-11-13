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

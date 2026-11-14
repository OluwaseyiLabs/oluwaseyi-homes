import { getPricing } from "@/lib/data";
import { buildFees } from "@/lib/pricing";

/** Every fee, kept separate: what it is, who pays, what it covers and when it is due. */
export async function Fees() {
  const fees = buildFees(await getPricing());
  return (
    <section id="fees" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">Our fees.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Searching, viewing prices and contacting owners is free. These are the only fees we charge. Rent,
          purchase price and the property’s own charges are shown on each property.
        </p>
        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {fees.map((f) => (
            <li key={f.id} className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <h3 className="text-xl font-bold tracking-tight">{f.name}</h3>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-green">{f.amount}</p>
              <dl className="mt-5 grid grid-cols-1 gap-4 text-sm">
                <div>
                  <dt className="font-semibold">Who pays</dt>
                  <dd className="mt-0.5 text-muted">{f.payer}</dd>
                </div>
                <div>
                  <dt className="font-semibold">What it covers</dt>
                  <dd className="mt-0.5 text-muted">{f.covers}</dd>
                </div>
                <div>
                  <dt className="font-semibold">When it is due</dt>
                  <dd className="mt-0.5 text-muted">{f.due}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

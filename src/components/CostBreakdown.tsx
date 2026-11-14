import { moveInCost, type Costs } from "@/lib/listings";
import { naira } from "@/lib/validation";

/** Everything a tenant pays to move in, row by row, with the total. */
export function CostBreakdown({ costs, note }: { costs: Costs; note: string }) {
  const { rows, total } = moveInCost(costs);
  return (
    <section className="mt-6 border-t border-line pt-6">
      <h3 className="text-lg font-bold">Complete payment breakdown</h3>
      <dl className="mt-3 grid grid-cols-1 gap-3">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt>{label}</dt>
            <dd className="tabular-nums">{naira(amount)}</dd>
          </div>
        ))}
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="text-lg font-bold">Total move-in cost</dt>
          <dd className="text-2xl font-extrabold tracking-tight text-green tabular-nums">{naira(total)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">{note}</p>
    </section>
  );
}

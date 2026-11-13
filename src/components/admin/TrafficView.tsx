"use client";

import { useState } from "react";
import { RANGES, TRACK_EVENTS, type Traffic } from "@/lib/track";
import { BarChart, Card, PageHeader, RankBars, Stat } from "./ui";

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "/properties/3-bedroom-flat-yaba-p-0004" becomes the property's title; other pages show as the path. */
export function pageLabel(path: string, names: Record<string, string>) {
  const code = Object.keys(names).find((c) => path.endsWith(`-${c}`) || path.endsWith(`/${c}`));
  return code ? names[code] : path;
}

export function TrafficView({ data, names }: { data: Record<number, Traffic>; names: Record<string, string> }) {
  const [range, setRange] = useState<number>(7);
  const t = data[range];
  const period = `last ${range} days`;
  const empty = t.visits === 0;
  const change = t.previous > 0 ? Math.round(((t.visits - t.previous) / t.previous) * 100) : null;
  const [topSource, topCount] = t.sources[0] ?? ["None yet", 0];

  return (
    <>
      <PageHeader
        title="Traffic"
        text="How many people visit the website, where they come from and what they click. No cookies and no personal details are kept."
        action={
          <div role="radiogroup" aria-label="Period" className="flex gap-1 rounded-full border border-line bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={r === range}
                onClick={() => setRange(r)}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] ${
                  r === range ? "bg-ink text-ground" : "text-muted hover:text-ink"
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Visits, ${period}`}
          value={t.visits.toLocaleString("en-GB")}
          note={change === null ? "Nothing to compare with yet" : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% on the ${range} days before`}
        />
        <Stat label={`Different visitors, ${period}`} value={t.visitors.toLocaleString("en-GB")} note="One person visiting twice in a day counts once" />
        <Stat label="Biggest source" value={topSource} note={empty ? "No visits yet" : `${Math.round((topCount / t.visits) * 100)}% of visits`} />
      </div>
      <Card className="mt-4">
        <h2 className="text-lg font-bold">Visits per day, {period}</h2>
        {empty ? (
          <p id="no-visits" className="mt-4 text-muted">No visits recorded in this period yet.</p>
        ) : (
          <BarChart key={range} data={t.days.map((d) => [dayLabel.format(new Date(`${d.day}T00:00:00Z`)), d.visits])} unit="visits" />
        )}
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Where visitors come from</h2>
          <p className="mt-1 text-sm text-muted">The site or app they were on when they tapped your link. Add ?utm_source=instagram to a link to name its source.</p>
          {t.sources.length ? <RankBars data={t.sources} /> : <p className="mt-4 text-muted">Nothing yet.</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Buttons people click</h2>
          {t.clicks.length ? <RankBars data={t.clicks.map(([e, n]) => [TRACK_EVENTS[e] ?? e, n])} /> : <p className="mt-4 text-muted">Nothing yet.</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Most viewed properties</h2>
          {t.topProperties.length ? <RankBars data={t.topProperties.map(([p, n]) => [pageLabel(p, names), n])} /> : <p className="mt-4 text-muted">Nothing yet.</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Devices</h2>
          {t.devices.length ? <RankBars data={t.devices.map(([d, n]) => [d.charAt(0).toUpperCase() + d.slice(1), n])} /> : <p className="mt-4 text-muted">Nothing yet.</p>}
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { Badge, BarChart, Card, PageHeader, RankBars, Stat, btnGhost } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { getAllListings, getRecentActivity, getSubmissions, getTraffic, getWaitingLeads } from "@/lib/data";
import { naira } from "@/lib/validation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Dashboard() {
  const currentUser = await requireUser("view");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const db = await supabaseServer();
  const [waiting, submissions, listings, traffic, activity] = await Promise.all([
    getWaitingLeads(db),
    currentUser.permissions.includes("submissions") ? getSubmissions(db) : [],
    getAllListings(db),
    getTraffic(db, [7, 14]),
    getRecentActivity(db),
  ]);
  const fresh = submissions.filter((s) => s.unread).length;
  const week = traffic[7];
  const published = listings.filter((l) => l.published);
  const change = week.previous > 0 ? Math.round(((week.visits - week.previous) / week.previous) * 100) : null;
  const when = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

  return (
    <>
      <PageHeader title={`${greeting}, ${currentUser.name}`} text={today} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Properties on the website" value={String(published.length)} note="Published and visible to visitors" />
        <Stat label="New owner submissions" value={String(fresh)} note="Waiting for someone to open them" />
        <Stat label="Enquiries waiting for approval" value={String(waiting.length)} note="Clients waiting for a landlord's contact" />
        <Stat
          label="Website visits, last 7 days"
          value={String(week.visits)}
          note={change === null ? "Nothing to compare with yet" : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% on the 7 days before`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Website visits, last 14 days</h2>
            <Link href="/admin/traffic" className="text-sm font-semibold text-green">See traffic</Link>
          </div>
          {traffic[14].visits === 0 ? (
            <p className="mt-4 text-muted">No visits recorded yet.</p>
          ) : (
            <BarChart
              data={traffic[14].days.map((d) => [new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d.day}T00:00:00Z`)), d.visits])}
              unit="visits"
            />
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Where visitors come from, last 7 days</h2>
          {week.sources.length ? <RankBars data={week.sources} /> : <p className="mt-4 text-muted">Nothing yet.</p>}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Latest owner submissions</h2>
            <Link href="/admin/submissions" className={btnGhost}>See all</Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {submissions.length === 0 && <li className="py-3.5 text-muted">No submissions yet.</li>}
            {submissions.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link href={`/admin/submissions?id=${s.id}`} className="flex items-center gap-4 py-3.5 transition hover:opacity-70">
                  <span className={`size-2 shrink-0 rounded-full ${s.unread ? "bg-gold" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {s.propertyType} to {s.purpose === "Rent" ? "rent" : "sell"}, {naira(s.amount)}
                    </span>
                    <span className="block truncate text-sm text-muted">{s.neighbourhood} · {s.id}</span>
                  </span>
                  <Badge>{s.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Properties by category</h2>
          <RankBars data={["Rent", "Buy", "Invest"].map((c) => [c, published.filter((l) => l.category === c).length])} />
          <h2 className="mt-8 text-lg font-bold">Recent activity</h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 text-sm">
            {activity.length === 0 && <li className="text-muted">Nothing yet.</li>}
            {activity.map((a, i) => (
              <li key={i}>
                <span className="font-semibold">{a.actor}</span> {a.action.charAt(0).toLowerCase() + a.action.slice(1)}
                <span className="block text-xs text-muted">{[a.lead, when(a.at)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

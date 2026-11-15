import type { ReactNode } from "react";

const paths: Record<string, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  inbox: "M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  users: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 19v-1a4 4 0 00-3-3.9M15.5 3.2a3.5 3.5 0 010 6.6",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  sheet: "M4 4h16v16H4zM4 10h16M4 15h16M10 4v16",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  plus: "M12 5v14M5 12h14",
  warning: "M12 4l9 16H3zM12 10v4M12 17.5v.5",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
};

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {text && <p className="mt-1 text-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <Card>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-3 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{value}</p>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </Card>
  );
}

const tones: Record<string, string> = {
  New: "bg-gold/20 text-ink",
  "New Enquiry": "bg-gold/20 text-ink",
  "Successfully Rented": "bg-green/10 text-green",
  "Successfully Sold": "bg-green/10 text-green",
  Paid: "bg-green/10 text-green",
  Issued: "bg-gold/20 text-ink",
  Unsuccessful: "bg-line text-muted",
  Disputed: "bg-red-50 text-red-700",
  "Needs review": "bg-red-50 text-red-700",
  Invited: "bg-gold/20 text-ink",
  Draft: "bg-line text-ink",
  Contacted: "bg-line text-ink",
  Closed: "bg-line text-muted",
  Approved: "bg-green/10 text-green",
  Published: "bg-green/10 text-green",
  Active: "bg-green/10 text-green",
  Rejected: "bg-red-50 text-red-700",
};

export function Badge({ children }: { children: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tones[children] ?? "bg-line text-ink"}`}>
      {children}
    </span>
  );
}

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-green text-white hover:bg-green-deep`;
export const btnGhost = `${btn} border border-ink/15 hover:border-ink`;

/** Shown beside controls that cannot save until the backend is connected. */
export function PreviewNote() {
  return <p className="text-xs text-muted">Preview: changes are not saved yet.</p>;
}

/** Vertical bars, one series. Hover or focus a bar for its value; a table is provided for screen readers. */
export function BarChart({ data, unit }: { data: [string, number][]; unit: string }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  // A scale that fits small numbers as well as big ones.
  const top = max <= 10 ? 10 : max <= 50 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 50) * 50;
  return (
    <div>
      <div className="relative mt-4 h-56" aria-hidden>
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 left-0 bg-surface pr-2 text-xs text-muted">{Math.round(top * f)}</span>
          </div>
        ))}
        <div className={`absolute inset-0 flex items-end pl-10 ${data.length > 40 ? "gap-px" : "gap-0.5"}`}>
          {data.map(([label, v]) => (
            <div key={label} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
              <div
                className="w-full rounded-t-sm bg-green transition-colors group-hover:bg-green-deep group-focus-visible:bg-green-deep"
                style={{ height: `${(v / top) * 100}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-ground group-hover:block group-focus-visible:block">
                {label}: {v} {unit}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-10 text-xs text-muted" aria-hidden>
        <span>{data[0][0]}</span>
        <span>{data[Math.floor(data.length / 2)][0]}</span>
        <span>{data[data.length - 1][0]}</span>
      </div>
      <table className="sr-only">
        <caption>{unit} per day</caption>
        <tbody>
          {data.map(([label, v]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ranked horizontal bars with the value written beside each one. */
export function RankBars({ data }: { data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  return (
    <ul className="mt-4 grid grid-cols-1 gap-3.5">
      {data.map(([label, v]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{label}</span>
            <span className="tabular-nums text-muted">{v}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-line">
            <div className="h-2 rounded-full bg-green" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

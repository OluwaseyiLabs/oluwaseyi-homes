"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setErrorFixed } from "@/app/admin/(dashboard)/errors/actions";
import { inputCls } from "@/components/Field";
import { Card, PageHeader, btnGhost } from "./ui";

export interface ErrorRow {
  id: string;
  ref: string;
  place: string;
  message: string;
  detail: { stack?: string[]; context?: Record<string, unknown> };
  staged: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Where an error came from, in plain words for someone who does not read code. */
function area(place: string) {
  if (place.startsWith("api/leads")) return "Enquiry form";
  if (place.startsWith("api/listings")) return "List a property form";
  if (place.startsWith("n8n")) return "Emails and automation (n8n)";
  if (place.startsWith("ratelimit")) return "Spam protection";
  if (place.startsWith("admin.test-error")) return "Test error (staged on purpose)";
  if (place.startsWith("r.")) return "Owner or customer link page";
  if (place.startsWith("account")) return "Your account";
  if (place.startsWith("errors")) return "Error page";
  if (/^(Render|Route|Action|Middleware|Proxy)/i.test(place)) return "A page or action crashed";
  return place;
}

export function ErrorLog({ rows, missing }: { rows: ErrorRow[]; missing: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState<"open" | "fixed" | "all">("open");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const shown = rows.filter((r) => (show === "all" || (show === "open" ? !r.resolved_at : !!r.resolved_at)) && (!q.trim() || `${r.ref} ${r.place} ${r.message}`.toLowerCase().includes(q.trim().toLowerCase())));
  const open = rows.filter((r) => !r.resolved_at && !r.staged).length;

  const mark = (id: string, fixed: boolean) =>
    start(async () => {
      setMsg("");
      const res = await setErrorFixed(id, fixed);
      if (res.error) setMsg(res.error);
      router.refresh();
    });

  return (
    <>
      <PageHeader title="Errors" text="Everything that went wrong on the website, with the reference people were shown. The Owner decides who else can see this page on the Team page." />
      {missing && (
        <Card className="mb-4">
          <p className="font-semibold">The error log is not set up yet.</p>
          <p className="mt-1 text-sm text-muted">Run the migration file 0015_error_log.sql in the Supabase SQL editor, then reload this page.</p>
        </Card>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {(["open", "fixed", "all"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`${btnGhost} min-h-10 px-4 text-sm aria-pressed:border-green aria-pressed:bg-green/10 aria-pressed:text-green`}>
                {k === "open" ? `Open (${open})` : k === "fixed" ? "Fixed" : "All"}
              </button>
            ))}
          </div>
          <input id="error-search" aria-label="Search by reference or words" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a reference, for example ERR-Q7K5R9" className={inputCls} />
        </div>
        {msg && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{msg}</p>}

        {shown.length === 0 ? (
          <p className="mt-6 text-muted">{rows.length === 0 && !missing ? "No errors have been recorded. That is good news." : "No errors match."}</p>
        ) : (
          <ul className="mt-5 grid grid-cols-1 divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-2 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-bold">{r.ref}</span>
                  {r.staged && <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs font-semibold text-muted">Test</span>}
                  {r.resolved_at && <span className="rounded-full bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green">Fixed by {r.resolved_by}</span>}
                  <span className="text-sm text-muted">{when.format(new Date(r.created_at))} (Lagos)</span>
                </div>
                <p className="font-semibold">{area(r.place)}</p>
                <p className="break-words text-sm">{r.message}</p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-muted">Details for whoever fixes it</summary>
                  <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-panel p-3 text-xs">{[`Place: ${r.place}`, ...(r.detail?.stack ?? []), r.detail?.context ? `Context: ${JSON.stringify(r.detail.context)}` : ""].filter(Boolean).join("\n")}</pre>
                </details>
                <div>
                  <button type="button" disabled={pending} onClick={() => mark(r.id, !r.resolved_at)} className={`${btnGhost} min-h-10 px-4 text-sm`}>
                    {r.resolved_at ? "Open it again" : "Mark as fixed"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

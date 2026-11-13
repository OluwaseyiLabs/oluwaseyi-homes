import { inspectionText, confirmedText } from "@/lib/leads";
import { progressSteps, type EnquiryProgress } from "@/lib/track";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** The progress of one enquiry, as a list of steps. */
export function TrackView({ progress }: { progress: EnquiryProgress }) {
  const { steps, declined, closed, disputed } = progressSteps(progress, {
    day: (iso) => dayFmt.format(new Date(iso)),
    moment: confirmedText,
    inspection: inspectionText,
  });
  return (
    <div id="track-result">
      <p className="text-sm font-semibold text-muted tabular-nums">{progress.code}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{progress.property ?? `Your ${progress.kind === "Rent" ? "rental" : "purchase"} enquiry`}</h2>
      {(declined || closed) && (
        <p className="mt-3 rounded-xl bg-gold/20 p-3 text-sm">
          {declined ? "This enquiry was not taken forward. Send a new enquiry if you would like us to help you find another property." : "This enquiry has been closed."}
        </p>
      )}
      {disputed && <p className="mt-3 rounded-xl bg-gold/20 p-3 text-sm">Our team is looking into this enquiry and will be in touch.</p>}
      <ol className="mt-6 grid gap-5">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-4">
            <span
              aria-hidden
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${
                s.state === "done" ? "border-green bg-green text-white" : s.state === "now" ? "border-gold bg-gold/20" : "border-line text-muted"
              }`}
            >
              {s.state === "done" ? "✓" : ""}
            </span>
            <span>
              <span className={`block font-semibold ${s.state === "later" ? "text-muted" : ""}`}>
                {s.label}
                {s.state === "now" && <span className="ml-2 rounded-full bg-gold/25 px-2 py-0.5 text-xs font-semibold">Now</span>}
              </span>
              {s.when && <span className="block text-sm text-muted">{s.when}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

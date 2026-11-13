"use client";

import { MailIcon } from "./ButtonIcons";
import { TURNSTILE_SITE_KEY, Turnstile, type TurnstileHandle } from "./Turnstile";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ENQUIRY_PRESET, type EnquiryPreset } from "@/lib/scroll";
import { assistFeeLabel } from "@/lib/pricing";
import { trackEvent } from "./Tracker";
import { useSite } from "./SiteProvider";
import { FacilityPicker } from "./FacilityPicker";
import { Field, inputCls } from "./Field";
import {
  ENQUIRY_TYPES,
  PROPERTY_TYPES,
  emptyLead,
  INSPECTION_DAYS,
  INSPECTION_SLOTS,
  addDays,
  lagosToday,
  needsMatch,
  onlyFacilities,
  validateLead,
  type ApiResponse,
  type LeadErrors,
  type LeadInput,
} from "@/lib/validation";

/** Where this visitor came from: a campaign tag if the link had one, else the referring site. */
function visitSource() {
  const tag = new URLSearchParams(window.location.search).get("utm_source");
  if (tag) return tag;
  try {
    const host = new URL(document.referrer).hostname;
    return host && host !== window.location.hostname ? host : "Direct";
  } catch {
    return "Direct";
  }
}

/** "code": the enquiry was accepted and the customer must enter the code emailed to them. */
type Status = "idle" | "sending" | "code" | "done" | "failed";

export function EnquiryForm({ facilities }: { facilities: string[] }) {
  const { site, pricing } = useSite();
  const [lead, setLead] = useState<LeadInput>(emptyLead);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [code, setCode] = useState("");
  const [wantsInspection, setWantsInspection] = useState(false);
  const [trackToken, setTrackToken] = useState("");
  // Spam checks: when the form was opened, and a hidden field that only a bot fills in.
  const startedAt = useRef(0);
  const [trap, setTrap] = useState("");
  // The CAPTCHA token, which works once. Empty until Cloudflare has checked the visitor.
  const [captcha, setCaptcha] = useState("");
  // True when the check could not run at all (for example a privacy tool blocked it), so we can say so.
  const [captchaBroken, setCaptchaBroken] = useState(false);
  const captchaBox = useRef<TurnstileHandle>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  /** True from the moment a code has been emailed until the lead is registered or the customer goes back. */
  const [awaitingCode, setAwaitingCode] = useState(false);

  useEffect(() => {
    // A property was chosen: fill in everything the property already tells us.
    const onPreset = (e: Event) => {
      const d = (e as CustomEvent<EnquiryPreset>).detail;
      setLead((l) => ({
        ...l,
        enquiryType: d.enquiryType,
        propertyType: d.propertyType ?? l.propertyType,
        location: d.location ?? l.location,
        budget: d.budget ?? l.budget,
        facilities: d.facilities !== undefined ? onlyFacilities(d.facilities, facilities) : l.facilities,
        specialRequirement: d.note ?? l.specialRequirement,
        listingId: d.listingId ?? "",
        inspectionDate: "",
        inspectionSlot: "",
      }));
      setErrors((er) => ({ ...er, enquiryType: undefined, propertyType: undefined, location: undefined, budget: undefined }));
    };
    window.addEventListener(ENQUIRY_PRESET, onPreset);
    return () => window.removeEventListener(ENQUIRY_PRESET, onPreset);
  }, [facilities]);

  const set = (key: keyof LeadInput) => (e: { target: { value: string } }) => {
    // Changing what they are looking for detaches the property they came from.
    setLead((l) => ({ ...l, [key]: e.target.value, ...(key === "enquiryType" ? { listingId: "" } : {}) }));
    setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er));
  };

  const props = (key: keyof LeadInput) => ({
    id: key,
    name: key,
    value: lead[key],
    onChange: set(key),
    className: inputCls,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });

  async function send(body: object, next: (data: NonNullable<ApiResponse["data"]>) => void, onFail: Status) {
    setStatus("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, turnstileToken: captcha }),
      });
      // A token works once, so ask for a fresh one whatever the answer was.
      if ((body as { action?: string }).action !== "verify") captchaBox.current?.reset();
      const json = (await res.json()) as ApiResponse;
      if (json.success && json.data) return next(json.data);
      setMessage(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setMessage("We could not reach the server. Check your connection and try again.");
    }
    setStatus(onFail);
  }

  /** Step 1: send the enquiry. A code is emailed to the customer. */
  function requestCode() {
    if (TURNSTILE_SITE_KEY && !captcha) {
      setMessage(
        captchaBroken
          ? "The security check could not start. Please turn off any ad blocker or privacy shield for this site, reload the page and try again, or use another browser."
          : "One moment, we are checking that you are not a robot. Please try again in a second or two.",
      );
      setStatus(awaitingCode ? "code" : "failed");
      return;
    }
    setCode("");
    return send({ ...lead, source: visitSource(), website: trap, startedAt: startedAt.current }, () => {
      setMessage("");
      setAwaitingCode(true);
      trackEvent("send_enquiry");
      if (lead.inspectionDate) trackEvent("request_inspection");
      setStatus("code");
    }, awaitingCode ? "code" : "failed");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateLead(lead);
    setErrors(found);
    if (Object.keys(found).length === 0) await requestCode();
  }

  /** Step 2: confirm the code. The lead is registered and its reference comes back. */
  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setMessage("Enter the 6-digit code from the email.");
    await send({ action: "verify", email: lead.email, code }, (data) => {
      setReference(data.reference ?? "");
      setTrackToken(data.trackToken ?? "");
      setMessage(data.message);
      setStatus("done");
    }, "code");
  }

  const matching = needsMatch(lead.enquiryType);

  if (status === "done") {
    return (
      <div role="status" className="rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <h3 className="text-3xl font-extrabold tracking-[-0.03em]">Enquiry received.</h3>
        <p className="mt-4 text-lg text-muted">{message}</p>
        <p className="mt-6 text-sm text-muted">
          Your reference: <strong className="text-ink">{reference}</strong>
        </p>
        {trackToken && (
          <p className="mt-4">
            <a id="track-link" href={`/track/${trackToken}`} className="text-sm font-semibold text-green underline underline-offset-4">
              Track your enquiry
            </a>
            <span className="ml-2 text-sm text-muted">We also emailed you this link.</span>
          </p>
        )}
      </div>
    );
  }

  if (awaitingCode) {
    return (
      <form onSubmit={onVerify} noValidate className="rounded-3xl border border-line bg-surface p-6 sm:p-10">
        <h3 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Check your email.</h3>
        <p className="mt-3 text-lg text-muted">
          We sent a 6-digit code to <strong className="break-words text-ink">{lead.email}</strong>. Enter it here to
          finish sending your enquiry. The code works for 10 minutes.
        </p>
        <div className="mt-6 max-w-xs">
          <Field label="6-digit code" name="code" required>
            <input
              id="code"
              name="code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setMessage("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-describedby={message ? "code-error" : undefined}
              className={`${inputCls} text-center text-2xl font-bold tracking-[0.4em]`}
            />
          </Field>
        </div>
        {message && (
          <p id="code-error" role="alert" className="mt-3 text-sm font-medium text-red-700">
            {message}
          </p>
        )}
        <Turnstile ref={captchaBox} action="enquiry" onToken={setCaptcha} onProblem={setCaptchaBroken} />
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green px-8 text-base font-semibold text-white icon-btn hover:bg-green-deep disabled:opacity-60 sm:w-auto"
          >
            <MailIcon />
            {status === "sending" ? "Checking…" : "Confirm and send enquiry"}
          </button>
          <button type="button" disabled={status === "sending"} onClick={requestCode} className="min-h-11 text-sm font-semibold text-green underline underline-offset-4 disabled:opacity-60">
            Send a new code
          </button>
          <button
            type="button"
            disabled={status === "sending"}
            onClick={() => {
              setAwaitingCode(false);
              setMessage("");
              setStatus("idle");
            }}
            className="min-h-11 text-sm font-semibold text-muted underline underline-offset-4 disabled:opacity-60"
          >
            Change my details
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-5 rounded-3xl border border-line bg-surface p-6 sm:grid-cols-2 sm:p-10"
    >
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="First name" name="firstName" error={errors.firstName} required>
        <input {...props("firstName")} autoComplete="given-name" />
      </Field>
      <Field label="Last name" name="lastName" error={errors.lastName} required>
        <input {...props("lastName")} autoComplete="family-name" />
      </Field>
      <Field label="Email" name="email" error={errors.email} required>
        <input {...props("email")} type="email" autoComplete="email" />
      </Field>
      <Field label="Phone" name="phone" error={errors.phone} required>
        <input {...props("phone")} type="tel" autoComplete="tel" />
      </Field>
      <Field label="What are you looking for?" name="enquiryType" error={errors.enquiryType} required>
        <select {...props("enquiryType")}>
          <option value="">Choose one</option>
          {ENQUIRY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Property type" name="propertyType" error={errors.propertyType} required>
        <select {...props("propertyType")}>
          <option value="">Choose one</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Preferred location" name="location" error={errors.location} required={matching}>
        <input {...props("location")} placeholder="For example, Yaba or Lekki Phase 1" />
      </Field>
      <Field
        label={lead.enquiryType === "Rent" ? "Budget per year" : "Budget"}
        name="budget"
        error={errors.budget}
        required={matching}
      >
        <input {...props("budget")} placeholder="For example, ₦1,500,000" />
      </Field>
      {matching && (
        <>
          <Field label="Intended move-in date" name="moveInDate" error={errors.moveInDate}>
            <input {...props("moveInDate")} type="date" />
          </Field>
          {lead.listingId && (
            <div className="rounded-2xl border border-line bg-panel p-5 sm:col-span-2">
              <label className="flex items-start gap-3 text-sm font-semibold">
                <input
                  id="inspect"
                  type="checkbox"
                  checked={!!lead.inspectionDate || wantsInspection}
                  onChange={(e) => {
                    setWantsInspection(e.target.checked);
                    if (!e.target.checked) setLead((l) => ({ ...l, inspectionDate: "", inspectionSlot: "" }));
                  }}
                  className="mt-0.5 size-5 shrink-0 accent-green"
                />
                <span>
                  I would like to inspect this property
                  <span className="block font-normal text-muted">Tell us when suits you. We confirm the time with the owner and email you both.</span>
                </span>
              </label>
              {(wantsInspection || lead.inspectionDate) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred date" name="inspectionDate" error={errors.inspectionDate} required>
                    <input {...props("inspectionDate")} type="date" min={lagosToday()} max={addDays(lagosToday(), INSPECTION_DAYS)} />
                  </Field>
                  <Field label="Time of day" name="inspectionSlot" error={errors.inspectionSlot} required>
                    <select {...props("inspectionSlot")}>
                      <option value="">Choose one</option>
                      {INSPECTION_SLOTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </div>
          )}
          <div className="sm:col-span-2">
            <FacilityPicker
              legend="Essential facilities"
              hint="Tick what the property must have."
              idPrefix="facility"
              options={facilities}
              value={lead.facilities}
              onChange={(v) => setLead((l) => ({ ...l, facilities: v }))}
            />
          </div>
        </>
      )}
      {lead.enquiryType === "Rent" && (
        <div className="rounded-2xl border border-line bg-panel p-5 sm:col-span-2">
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input
              id="assistance"
              type="checkbox"
              checked={lead.assistance === "yes"}
              onChange={(e) => setLead((l) => ({ ...l, assistance: e.target.checked ? "yes" : "" }))}
              className="mt-0.5 size-5 shrink-0 accent-green"
            />
            <span>
              Add the tenant assistance service
              <span className="font-normal text-muted"> (optional, {assistFeeLabel(pricing).toLowerCase()})</span>
            </span>
          </label>
          <p className="mt-2 pl-8 text-sm text-muted">
            We help you find a property, arrange inspections and go through the rental process. Enquiring and
            contacting owners is free without it. We agree the fee with you before any work starts, and you pay
            nothing unless you accept.
          </p>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field label="Special requirements" name="specialRequirement">
          <textarea {...props("specialRequirement")} rows={4} className={`${inputCls} py-3`} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input
            id="acknowledged"
            type="checkbox"
            checked={lead.acknowledged === "yes"}
            onChange={(e) => {
              setLead((l) => ({ ...l, acknowledged: e.target.checked ? "yes" : "" }));
              setErrors((er) => ({ ...er, acknowledged: undefined }));
            }}
            aria-describedby={errors.acknowledged ? "acknowledged-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-green"
          />
          <span>
            I acknowledge that {site.name} is introducing me to the owner of any property I am connected to
            through this enquiry.
            <span className="mt-1 block font-normal text-muted">
              We record this enquiry with a reference number and keep your name, email and phone number so the
              introduction can be traced. Your details are shared only with the owner of a property you are
              matched to. See our{" "}
              <a href="/legal/privacy" target="_blank" rel="noopener" className="font-semibold text-green underline underline-offset-4">Privacy Policy</a> and{" "}
              <a href="/legal/terms" target="_blank" rel="noopener" className="font-semibold text-green underline underline-offset-4">Terms of Use</a>.
            </span>
          </span>
        </label>
        {errors.acknowledged && (
          <p id="acknowledged-error" className="mt-1.5 text-sm text-red-700">
            {errors.acknowledged}
          </p>
        )}
      </div>

      {status === "failed" && (
        <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
          {message}
        </p>
      )}

      <div className="sm:col-span-2">
        <Turnstile ref={captchaBox} action="enquiry" onToken={setCaptcha} onProblem={setCaptchaBroken} />
        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-0 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-green px-8 text-base font-semibold text-white icon-btn icon-btn-wide hover:bg-green-deep disabled:opacity-60"
        >
          <MailIcon />
          {status === "sending" ? "Sending…" : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}

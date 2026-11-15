"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CAUTION_RATES,
  LISTING_PURPOSES,
  MAX_IMAGES,
  OWNER_TITLES,
  PROPERTY_TYPES,
  RELATIONSHIPS,
  emptyListing,
  naira,
  parseNaira,
  validateListing,
  type ApiResponse,
  type ListingErrors,
  type ListingInput,
  type ListingPurpose,
} from "@/lib/validation";
import { compress } from "@/lib/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ownerFields, type DetailField } from "@/lib/listings";
import { agreementTerms, ownerFees, type Pricing } from "@/lib/pricing";
import { trackEvent } from "./Tracker";
import { useSite } from "./SiteProvider";
import { DetailInput } from "./DetailInput";
import { FacilityPicker } from "./FacilityPicker";
import { Field, inputCls } from "./Field";
import { PhotoDropzone } from "./PhotoDropzone";

interface Photo {
  file: File;
  url: string;
}

const purposeLabel: Record<ListingPurpose, string> = {
  Rent: "List property to rent",
  Sell: "List property to sell",
};

const PAYSTACK_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

interface Paystack {
  newTransaction(o: {
    key: string;
    email: string;
    amount: number;
    currency: string;
    onSuccess: (t: { reference: string }) => void;
    onCancel: () => void;
  }): void;
}

/** Opens the Paystack checkout for the listing fee. Resolves to the payment reference, or null if closed. */
async function payListingFee(email: string, pricing: Pricing): Promise<string | null> {
  const w = window as unknown as { PaystackPop?: new () => Paystack };
  if (!w.PaystackPop)
    await new Promise<void>((ok, bad) => {
      const el = document.createElement("script");
      el.src = "https://js.paystack.co/v2/inline.js";
      el.onload = () => ok();
      el.onerror = () => bad(new Error("Paystack did not load"));
      document.head.append(el);
    });
  return new Promise((resolve) =>
    new w.PaystackPop!().newTransaction({
      key: PAYSTACK_KEY!,
      email,
      amount: pricing.listingFee * 100, // kobo
      currency: "NGN",
      onSuccess: (t) => resolve(t.reference),
      onCancel: () => resolve(null),
    }),
  );
}

type Status = "idle" | "sending" | "done" | "failed";

export function ListPropertyForm({ detailFields, facilities }: { detailFields: DetailField[]; facilities: string[] }) {
  const { pricing } = useSite();
  const [data, setData] = useState<ListingInput>(emptyListing);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  // Kept after a successful payment, so a failed submit can be retried without paying twice.
  const paidRef = useRef("");
  const live = useRef<Photo[]>([]);

  useEffect(() => {
    live.current = photos;
  }, [photos]);
  useEffect(() => () => live.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const props = (key: keyof ListingInput) => ({
    id: `list-${key}`,
    name: key,
    value: data[key],
    onChange: (e: { target: { value: string } }) => {
      setData((d) => ({ ...d, [key]: e.target.value }));
      setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er));
    },
    className: inputCls,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `list-${key}-error` : undefined,
  });

  async function addPhotos(picked: File[]) {
    const room = MAX_IMAGES - photos.length;
    if (picked.length === 0) return;
    setBusy(true);
    const added: Photo[] = [];
    let unreadable = 0;
    for (const f of picked.slice(0, room)) {
      try {
        const file = await compress(f);
        added.push({ file, url: URL.createObjectURL(file) });
      } catch {
        unreadable++;
      }
    }
    setBusy(false);
    setPhotos((p) => [...p, ...added]);
    setErrors((er) => ({
      ...er,
      images: unreadable
        ? "Some photos could not be read. Use JPG or PNG files."
        : picked.length > room
          ? `Only ${MAX_IMAGES} photos can be added.`
          : undefined,
    }));
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((p) => p.filter((x) => x.url !== url));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateListing(data, {
      count: photos.length,
      bytes: photos.reduce((n, p) => n + p.file.size, 0),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const stop = (text: string) => {
      setMessage(text);
      setStatus("failed");
    };
    if (!paidRef.current) {
      if (!PAYSTACK_KEY)
        return stop("Online payment is not connected yet, so the property cannot be submitted. You have not been charged.");
      setStatus("sending");
      const ref = await payListingFee(data.email.trim(), pricing).catch(() => undefined);
      if (ref === undefined) return stop("The payment page could not open. Check your connection and try again.");
      if (ref === null) return stop("Payment was not completed, so your property has not been submitted.");
      paidRef.current = ref;
    }

    const kept = "Your payment is recorded: press the button again and you will not be charged twice.";
    setStatus("sending");
    try {
      const call = async (body: object) =>
        (await (await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as ApiResponse<{
          uploads?: { path: string; token: string }[];
          reference?: string;
          message?: string;
        }>;

      // 1. One-time upload links, given only once the payment is confirmed.
      const prepared = await call({ step: "prepare", paymentReference: paidRef.current, count: photos.length });
      if (!prepared.success || !prepared.data?.uploads) return stop(`${prepared.error ?? "Something went wrong."} ${kept}`);

      // 2. Photos go straight to storage.
      const storage = supabaseBrowser().storage.from("submissions");
      for (const [i, u] of prepared.data.uploads.entries()) {
        const { error } = await storage.uploadToSignedUrl(u.path, u.token, photos[i].file, { contentType: "image/jpeg", upsert: true });
        if (error) return stop(`Photo ${i + 1} could not be uploaded. Check your connection. ${kept}`);
      }

      // 3. The details. Only the additional details that apply to this kind of listing are sent.
      const asked = ownerFields(detailFields, data.purpose).map((f) => f.id);
      const json = await call({
        ...data,
        details: Object.fromEntries(asked.map((id) => [id, details[id] ?? ""])),
        paymentReference: paidRef.current,
      });
      if (json.success && json.data) {
        setReference(json.data.reference ?? "");
        setMessage(json.data.message ?? "");
        trackEvent("submit_property");
        setStatus("done");
      } else stop(`${json.error ?? "Something went wrong. Please try again."} ${kept}`);
    } catch {
      stop(`We could not reach the server. ${kept}`);
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="mt-8">
        <h4 className="text-2xl font-extrabold tracking-tight">Property received.</h4>
        <p className="mt-3 text-lg text-muted">{message}</p>
        <p className="mt-4 text-sm text-muted">
          Your reference: <strong className="text-ink">{reference}</strong>
        </p>
      </div>
    );
  }

  const selling = data.purpose === "Sell";
  const rent = parseNaira(data.askingAmount);

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8">
      <div role="radiogroup" aria-label="What do you want to do?" className="flex flex-wrap gap-2">
        {LISTING_PURPOSES.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={data.purpose === p}
            onClick={() => setData((d) => ({ ...d, purpose: p }))}
            className={`min-h-12 rounded-full border px-6 text-sm font-semibold transition active:scale-[0.97] ${
              data.purpose === p
                ? "border-ink bg-ink text-ground"
                : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {purposeLabel[p]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {selling ? (
          <div className="max-w-sm">
            <Field
              label="How are you related to this property?"
              name="list-relationship"
              error={errors.relationship}
              required
            >
              <select {...props("relationship")}>
                <option value="">Choose one</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                id="list-ownerConfirmed"
                type="checkbox"
                checked={data.ownerConfirmed === "yes"}
                onChange={(e) => {
                  setData((d) => ({ ...d, ownerConfirmed: e.target.checked ? "yes" : "" }));
                  setErrors((er) => ({ ...er, ownerConfirmed: undefined }));
                }}
                aria-describedby={errors.ownerConfirmed ? "list-ownerConfirmed-error" : undefined}
                className="size-5 shrink-0 accent-green"
              />
              I confirm that I am the landlord or owner of this property.
            </label>
            {errors.ownerConfirmed && (
              <p id="list-ownerConfirmed-error" className="mt-1.5 text-sm text-red-700">
                {errors.ownerConfirmed}
              </p>
            )}
          </div>
        )}
        <p className="mt-4 max-w-xl text-sm text-muted">
          When a client enquires about this property and we approve the enquiry, we send them your
          WhatsApp number and email so they can contact you directly.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Your name" name="list-fullName" error={errors.title ?? errors.fullName} required>
          <div className="flex flex-col gap-0 min-[360px]:flex-row min-[360px]:gap-2">
            <select {...props("title")} aria-label="Title" aria-describedby={errors.title ? "list-fullName-error" : undefined} autoComplete="honorific-prefix" className={`${inputCls} shrink-0 min-[360px]:w-28!`}>
              <option value="">Title</option>
              {OWNER_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input {...props("fullName")} autoComplete="name" className={`${inputCls} min-w-0`} />
          </div>
        </Field>
        <Field label="WhatsApp number" name="list-phone" error={errors.phone} required>
          <input {...props("phone")} type="tel" autoComplete="tel" />
        </Field>
        <Field label="Email" name="list-email" error={errors.email} required>
          <input {...props("email")} type="email" autoComplete="email" />
        </Field>
        <Field label="Property type" name="list-propertyType" error={errors.propertyType} required>
          <select {...props("propertyType")}>
            <option value="">Choose one</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {data.propertyType === "Others" && (
          <Field label="What kind of property?" name="list-propertyOther" error={errors.propertyOther} required>
            <input {...props("propertyOther")} maxLength={60} placeholder="For example, boys' quarters, warehouse, hotel" />
          </Field>
        )}
        <Field label="Number of bedrooms" name="list-bedrooms" error={errors.bedrooms}>
          <input {...props("bedrooms")} inputMode="numeric" placeholder="Leave empty for land or a shop" />
        </Field>
        <Field label="Property address" name="list-address" error={errors.address} required>
          <input {...props("address")} placeholder="House number and street" />
        </Field>
        <Field label="Area or neighbourhood" name="list-neighbourhood" error={errors.neighbourhood} required>
          <input {...props("neighbourhood")} placeholder="For example, Yaba, Lagos" />
        </Field>
        <Field
          label={selling ? "Asking price" : "Annual rent"}
          name="list-askingAmount"
          error={errors.askingAmount}
          required
        >
          <input
            {...props("askingAmount")}
            inputMode="numeric"
            placeholder={selling ? "For example, ₦95,000,000" : "For example, ₦1,000,000"}
          />
        </Field>
        {!selling && (
          <>
            <Field label="Legal/agreement fee" name="list-legalFee" error={errors.legalFee}>
              <input {...props("legalFee")} inputMode="numeric" placeholder="Amount in naira, if any" />
            </Field>
            <Field label="Caution deposit" name="list-cautionRate" error={errors.cautionRate}>
              <select {...props("cautionRate")}>
                <option value="">No caution deposit</option>
                {CAUTION_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r} of the annual rent
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Service charge per year" name="list-serviceCharge" error={errors.serviceCharge}>
              <input {...props("serviceCharge")} inputMode="numeric" placeholder="Amount in naira, if any" />
            </Field>
            <Field label="What the service charge covers" name="list-serviceCovers">
              <input {...props("serviceCovers")} placeholder="For example, security, cleaning and waste" />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <FacilityPicker
            legend="Available facilities"
            hint="Tick everything the property has."
            idPrefix="list-facility"
            options={facilities}
            value={data.facilities}
            onChange={(v) => setData((d) => ({ ...d, facilities: v }))}
          />
        </div>
        <Field label="Parking arrangements" name="list-parking">
          <input {...props("parking")} placeholder="For example, two cars inside the compound" />
        </Field>
        <Field label="Security arrangements" name="list-security">
          <input {...props("security")} placeholder="For example, gated street with a guard" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Inspection availability" name="list-inspection">
            <input {...props("inspection")} placeholder="Days and times the property can be viewed" />
          </Field>
        </div>
        {ownerFields(detailFields, data.purpose).map((f) => (
          <Field key={f.id} label={f.label} name={`list-d-${f.id}`}>
            <DetailInput
              field={f}
              id={`list-d-${f.id}`}
              value={details[f.id]}
              onChange={(v) => setDetails((d) => ({ ...d, [f.id]: v }))}
            />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="About the property" name="list-description">
            <textarea
              {...props("description")}
              rows={4}
              className={`${inputCls} py-3`}
              placeholder="Bathrooms, size, condition and anything a buyer or tenant should know"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <p className="text-sm font-semibold">Photographs of the property</p>
          <p className="mt-1 text-sm text-muted">
            Add up to {MAX_IMAGES} photos. Clear photos of each room and the outside help most.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-green/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => removePhoto(p.url)}
                  className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-white/95 text-coal text-lg leading-none transition active:scale-95"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <PhotoDropzone inputId="list-images" onFiles={addPhotos} busy={busy} remaining={MAX_IMAGES - photos.length} max={MAX_IMAGES} describedBy={errors.images ? "list-images-error" : undefined} />
          {errors.images && (
            <p id="list-images-error" className="mt-2 text-sm text-red-700">
              {errors.images}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Field label="Video of the property" name="list-videoLink" error={errors.videoLink}>
            <input
              {...props("videoLink")}
              type="url"
              placeholder="Paste a link to the video (YouTube, Google Drive, Instagram or TikTok)"
            />
          </Field>
        </div>
      </div>

      <section aria-labelledby="list-fees" className="mt-8 rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <h4 id="list-fees" className="text-lg font-bold">Property Listing and Agency Agreement</h4>
        <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {ownerFees(pricing, data.purpose).map((f) => (
            <li key={f.id} className="text-sm">
              <p className="font-semibold">{f.name}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-green">{f.amount}</p>
              {f.id === "agency" && rent > 0 && (
                <p className="mt-1 font-semibold">
                  {naira((rent * pricing.agencyFeePct) / 100)} on the rent you entered.
                </p>
              )}
              <p className="mt-2 text-muted">{f.covers}</p>
              <p className="mt-2">
                <span className="font-semibold">Due: </span>
                <span className="text-muted">{f.due}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          {selling
            ? "These are two separate charges. Only the listing fee is paid today."
            : "These are two separate charges. Only the listing fee is paid today. The tenant is not charged the agency fee."}
        </p>
        <ul className="mt-4 grid grid-cols-1 list-disc gap-2 pl-5 text-sm text-muted">
          {agreementTerms(pricing).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input
            id="list-feesAccepted"
            type="checkbox"
            checked={data.feesAccepted === "yes"}
            onChange={(e) => {
              setData((d) => ({ ...d, feesAccepted: e.target.checked ? "yes" : "" }));
              setErrors((er) => ({ ...er, feesAccepted: undefined }));
            }}
            aria-describedby={errors.feesAccepted ? "list-feesAccepted-error" : undefined}
            className="size-5 shrink-0 accent-green"
          />
          <span>
            I accept this agreement and these fees. Read the{" "}
            <a href="/legal/agreement" target="_blank" rel="noopener" className="font-semibold text-green underline underline-offset-4">full agreement</a>, the{" "}
            <a href="/legal/refunds" target="_blank" rel="noopener" className="font-semibold text-green underline underline-offset-4">Refund Policy</a> and the{" "}
            <a href="/legal/privacy" target="_blank" rel="noopener" className="font-semibold text-green underline underline-offset-4">Privacy Policy</a>.
          </span>
        </label>
        {errors.feesAccepted && (
          <p id="list-feesAccepted-error" className="mt-1.5 text-sm text-red-700">
            {errors.feesAccepted}
          </p>
        )}
      </section>

      {status === "failed" && (
        <p role="alert" className="mt-5 text-sm font-medium text-red-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || busy}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep active:scale-[0.97] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : `Pay ${naira(pricing.listingFee)} and submit property`}
      </button>
    </form>
  );
}

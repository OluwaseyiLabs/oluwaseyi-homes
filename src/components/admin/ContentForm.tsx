"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { resetHeroImage, saveContent, saveFees, saveHeroImage } from "@/app/admin/(dashboard)/content/actions";
import { Field, inputCls } from "@/components/Field";
import { compress } from "@/lib/image";
import { photoUrl } from "@/lib/listings";
import type { Pricing } from "@/lib/pricing";
import { CONTENT_FIELDS } from "@/lib/site-content";
import { Card, PageHeader, btnGhost, btnPrimary } from "./ui";

const sections = [
  ["Company", "Used in the logo, the browser tab, the footer and the WhatsApp buttons. Emails sent by the automation keep the wording written there."],
  ["Top of the page", "The first thing visitors see."],
  ["Animated statement", "The large paragraph that animates in below the top of the page."],
  ["Properties section", "Headings around the property tabs and the List Property form."],
  ["How it works", "The green band with the three steps."],
  ["Enquiry and footer", "The enquiry heading and the line at the bottom of every page."],
] as const;

/** Saves with a server action, then shows the result next to the button that was pressed. */
function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (action: () => Promise<{ error: string | null }>, done: string) =>
    start(async () => {
      setMessage(null);
      const res = await action();
      setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: done });
      if (!res.error) router.refresh();
    });
  return { pending, message, run };
}

const Note = ({ m }: { m: { ok: boolean; text: string } | null }) =>
  m ? (
    <p role={m.ok ? "status" : "alert"} className={`text-sm font-medium ${m.ok ? "text-green" : "text-red-700"}`}>{m.text}</p>
  ) : null;

export function ContentForm({
  values,
  heroImage,
  isDefaultHero,
  pricing,
  canEditFees,
}: {
  values: Record<string, string>;
  heroImage: string;
  isDefaultHero: boolean;
  pricing: Pricing;
  canEditFees: boolean;
}) {
  const wording = useSave();
  const photo = useSave();
  const fees = useSave();
  const file = useRef<HTMLInputElement>(null);

  const saveWording = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    wording.run(() => saveContent(form), "Saved. The website shows it within a few minutes at most.");
  };

  async function pickPhoto() {
    const picked = file.current?.files?.[0];
    if (!picked) return;
    const small = await compress(picked).catch(() => null);
    if (!small) return photo.run(async () => ({ error: "That file could not be read. Use a JPG or PNG." }), "");
    const form = new FormData();
    form.set("hero", small);
    photo.run(() => saveHeroImage(form), "Photo replaced.");
    if (file.current) file.current.value = "";
  }

  const saveFeesForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fees.run(() => saveFees(form), "Fees saved. New agreements use the new version.");
  };

  return (
    <>
      <PageHeader title="Website content" text="Change the words, the photo, the company name and the fees shown on the public website." />

      <form onSubmit={saveWording} className="grid grid-cols-1 gap-4">
        {sections.map(([title, text]) => (
          <Card key={title}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {title === "Top of the page" && (
                  <div>
                    <p className="text-sm font-semibold">Photo</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <div className="relative aspect-[4/3] w-40 overflow-hidden rounded-xl bg-green/10">
                        <Image src={photoUrl(heroImage)} alt="Current photo at the top of the page" fill sizes="160px" className="object-cover" />
                      </div>
                      <input ref={file} id="hero-file" type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
                      <label htmlFor="hero-file" className={`${btnGhost} cursor-pointer`}>{photo.pending ? "Uploading…" : "Replace photo"}</label>
                      {!isDefaultHero && (
                        <button type="button" disabled={photo.pending} onClick={() => photo.run(resetHeroImage, "Original photo restored.")} className={btnGhost}>
                          Use the original photo
                        </button>
                      )}
                      <Note m={photo.message} />
                    </div>
                  </div>
                )}
                {CONTENT_FIELDS.filter((f) => f.section === title).map((f) => (
                  <Field key={f.key} label={f.label} name={`c-${f.key}`} required>
                    {f.long ? (
                      <textarea id={`c-${f.key}`} name={f.key} rows={3} defaultValue={values[f.key]} className={`${inputCls} py-3`} />
                    ) : (
                      <input id={`c-${f.key}`} name={f.key} defaultValue={values[f.key]} className={inputCls} />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          </Card>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={wording.pending} className={btnPrimary}>{wording.pending ? "Saving…" : "Save wording"}</button>
          <Note m={wording.message} />
        </div>
      </form>

      <Card className="mt-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div>
            <h2 className="text-lg font-bold">Fees</h2>
            <p className="mt-1 text-sm text-muted">
              Shown in the fees section, the List Property form and the enquiry form. Agreement version now: <strong className="text-ink">{pricing.agreementVersion}</strong>.
            </p>
            <p className="mt-3 text-sm text-muted">
              Changing a fee starts a new agreement version. Owners who already accepted keep the terms they accepted.
            </p>
          </div>
          {canEditFees ? (
            <form onSubmit={saveFeesForm} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Property listing fee, paid by the owner when listing (naira)" name="f-listing" required>
                <input id="f-listing" name="listingFee" inputMode="numeric" defaultValue={pricing.listingFee} className={inputCls} />
              </Field>
              <Field label="Agency fee on rentals, paid by the landlord (% of the annual rent)" name="f-agency" required>
                <input id="f-agency" name="agencyFeePct" inputMode="decimal" defaultValue={pricing.agencyFeePct} className={inputCls} />
              </Field>
              <Field label="Sale commission, paid by the seller (% of the sale price)" name="f-sale" required>
                <input id="f-sale" name="saleCommissionPct" inputMode="decimal" defaultValue={pricing.saleCommissionPct} className={inputCls} />
              </Field>
              <Field label="Protection period (months)" name="f-months" required>
                <input id="f-months" name="protectionMonths" inputMode="numeric" defaultValue={pricing.protectionMonths} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tenant assistance service, optional (naira). Leave empty to show “Fee to be confirmed”" name="f-assist">
                  <input id="f-assist" name="tenantAssistFee" inputMode="numeric" defaultValue={pricing.tenantAssistFee ?? ""} className={inputCls} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button disabled={fees.pending} className={btnPrimary}>{fees.pending ? "Saving…" : "Save fees"}</button>
                <Note m={fees.message} />
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">Only the Owner can change the fees.</p>
          )}
        </div>
      </Card>
    </>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { addDetailField, addFacility, deleteListing, removeDetailField, removeFacility, saveListing } from "@/app/admin/(dashboard)/properties/actions";
import { Field, inputCls } from "@/components/Field";
import { PhotoDropzone } from "@/components/PhotoDropzone";
import { ListingCard } from "@/components/ListingCard";
import { ListingDetail } from "@/components/ListingDetail";
import { compress } from "@/lib/image";
import { cleanDetails, photoUrl, specs, type DetailField, type Listing } from "@/lib/listings";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { CAUTION_RATES, PROPERTY_TYPES, naira, parseNaira } from "@/lib/validation";
import { DetailFields } from "./DetailFields";
import { OwnerPanel } from "./OwnerPanel";
import { Badge, Icon, PageHeader, btnGhost, btnPrimary } from "./ui";

const filters = ["All", "Rent", "Buy", "Invest"] as const;
const MAX_PHOTOS = 12;
interface Can {
  edit: boolean;
  publish: boolean;
  approve: boolean;
}

/** Shows a property exactly as visitors would see it: the card in the list, and the full view when it is clicked. */
function PreviewDialog({ listing, fields, onClose }: { listing: Listing; fields: DetailField[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      // The full view is a dialog inside this one: only react to this dialog's own close.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label="Preview on the website"
      className="m-auto max-h-[92svh] w-[min(26rem,calc(100%-1.5rem))] overflow-y-auto glass-panel glass-scrim rounded-3xl border border-white/60 p-0 text-ink"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight">Preview on the website</h2>
          <button type="button" aria-label="Close preview" onClick={() => ref.current?.close()} className="grid size-11 place-items-center rounded-full text-2xl transition hover:bg-line">×</button>
        </div>
        <p className="mt-1 text-sm text-muted">
          This is how the property looks in the list. Click it to see the full view. Nothing is saved or sent.
        </p>
        {!listing.published && (
          <p className="mt-3 rounded-xl bg-gold/20 p-3 text-sm">Visitors will not see this until you tick Published.</p>
        )}
        {listing.images.length === 0 && <p className="mt-3 rounded-xl bg-gold/20 p-3 text-sm">No photos yet. Add at least one before saving.</p>}
        <div className="mt-5 grid grid-cols-1">
          <ListingCard listing={listing} index={0} onOpen={() => setOpen(true)} />
        </div>
      </div>
      {open && <ListingDetail listing={listing} detailFields={fields} preview onClose={() => setOpen(false)} />}
    </dialog>
  );
}

function Editor({
  listing,
  fields,
  facilities,
  can,
  onClose,
}: {
  listing: Listing | null;
  fields: DetailField[];
  facilities: string[];
  can: Can;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const v = listing;
  const [category, setCategory] = useState<string>(v?.category ?? "Rent");
  /** Stored paths, in order. The first is the cover. */
  const [photos, setPhotos] = useState<string[]>(v?.imagePaths ?? []);
  const [busy, setBusy] = useState<"" | "photos" | "saving" | "deleting">("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Listing | null>(null);
  // Facilities: the ticked ones, any just created (shown before the page reloads), and the box for a new name.
  const [chosen, setChosen] = useState<string[]>(v?.facilities ?? []);
  const [created, setCreated] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [facilityName, setFacilityName] = useState("");
  const [facilityError, setFacilityError] = useState("");
  // The list, plus anything this property already has that is no longer in the list.
  const options = [...new Set([...facilities, ...created, ...(v?.facilities ?? [])])].filter((f) => !removed.includes(f) || chosen.includes(f));

  async function createFacility() {
    const res = await addFacility(facilityName);
    if (res.error) return setFacilityError(res.error);
    const name = facilityName.replace(/\s+/g, " ").trim();
    setCreated((c) => [...c, name]);
    setChosen((c) => [...c, name]);
    setFacilityName("");
    setFacilityError("");
    setAdding(false);
    router.refresh();
  }

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function addPhotos(files: File[]) {
    const picked = files.slice(0, MAX_PHOTOS - photos.length);
    if (!picked.length) return;
    setBusy("photos");
    setError("");
    const db = supabaseBrowser();
    const added: string[] = [];
    let failed = 0;
    for (const f of picked) {
      try {
        const file = await compress(f);
        const path = `${crypto.randomUUID()}.jpg`;
        const { error: up } = await db.storage.from("listings").upload(path, file, { contentType: "image/jpeg" });
        if (up) throw up;
        added.push(path);
      } catch {
        failed++;
      }
    }
    setPhotos((p) => [...p, ...added]);
    if (failed) setError(`${failed} photo${failed === 1 ? "" : "s"} could not be uploaded. Use JPG or PNG files and try again.`);
    setBusy("");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("photos", JSON.stringify(photos));
    form.set(
      "details",
      JSON.stringify(Object.fromEntries(fields.map((f) => [f.id, (document.getElementById(`d-${f.id}`) as HTMLInputElement | null)?.value ?? ""]))),
    );
    setBusy("saving");
    setError("");
    const res = await saveListing(form);
    setBusy("");
    if (res.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  async function onDelete() {
    if (!v?.dbId || !window.confirm(`Delete "${v.title}" for good? This cannot be undone.`)) return;
    setBusy("deleting");
    const res = await deleteListing(v.dbId);
    setBusy("");
    if (res.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  const rent = category === "Rent";

  /** The property as the website would show it, built from what is typed in the form right now. Nothing is saved. */
  function buildPreview(): Listing {
    const f = new FormData(formRef.current!);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const num = (k: string) => Number(text(k).replace(/\D/g, "")) || undefined;
    const caution = Number(text("cautionRate").replace("%", "")) || 0;
    const rawDetails = Object.fromEntries(fields.map((d) => [d.id, (document.getElementById(`d-${d.id}`) as HTMLInputElement | null)?.value ?? ""]));
    const isRent = text("category") === "Rent";
    return {
      id: v?.id ?? "NEW",
      category: text("category") as Listing["category"],
      propertyType: text("propertyType"),
      title: text("title") || "(No title yet)",
      location: text("location") || "(No location yet)",
      price: naira(parseNaira(text("price"))),
      beds: num("beds"),
      baths: num("baths"),
      size: text("size") || undefined,
      description: text("description"),
      details: cleanDetails(fields, rawDetails),
      costs: isRent
        ? { rent: parseNaira(text("price")), agencyFee: parseNaira(text("agencyFee")), legalFee: parseNaira(text("legalFee")), cautionPct: caution, serviceCharge: parseNaira(text("serviceCharge")) }
        : undefined,
      serviceCovers: isRent ? text("serviceCovers") || undefined : undefined,
      facilities: chosen,
      parking: text("parking") || undefined,
      security: text("security") || undefined,
      inspection: text("inspection") || undefined,
      video: text("video") || undefined,
      verified: f.get("verified") === "on",
      published: f.get("published") === "on",
      images: photos.map(photoUrl),
    };
  }

  return (
    <dialog
      ref={ref}
      // The preview is a dialog inside this one: ignore its close event, or closing it would close the editor and lose the edits.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      aria-label={v ? `Edit ${v.title}` : "Add property"}
      className="m-auto max-h-[92svh] w-[min(46rem,calc(100%-1.5rem))] overflow-y-auto glass-panel glass-scrim rounded-3xl border border-white/60 p-0 text-ink"
    >
      <form ref={formRef} onSubmit={onSubmit} className="p-6 sm:p-8">
        <input type="hidden" name="dbId" value={v?.dbId ?? ""} />
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">{v ? "Edit property" : "Add property"}</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-11 place-items-center rounded-full text-2xl transition hover:bg-panel">×</button>
        </div>
        {v?.sample && (
          <p className="mt-4 rounded-xl bg-gold/20 p-3 text-sm">
            This is a sample with made-up details. Delete it once a real property takes its place.
          </p>
        )}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Show under" name="p-category" required>
            <select id="p-category" name="category" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {filters.slice(1).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Property type" name="p-type" required>
            <select id="p-type" name="propertyType" className={inputCls} defaultValue={v?.propertyType ?? "Apartment"}>
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" name="p-title" required>
              <input id="p-title" name="title" className={inputCls} defaultValue={v?.title} placeholder="For example, Two-bedroom apartment" />
            </Field>
          </div>
          <Field label="Location and neighbourhood" name="p-location" required>
            <input id="p-location" name="location" className={inputCls} defaultValue={v?.location} placeholder="For example, Yaba, Lagos" />
          </Field>
          <Field label={rent ? "Annual rent" : "Price"} name="p-price" required>
            <input id="p-price" name="price" inputMode="numeric" className={inputCls} defaultValue={v?.price} placeholder="Amount in naira" />
          </Field>
          <Field label="Bedrooms" name="p-beds">
            <input id="p-beds" name="beds" inputMode="numeric" className={inputCls} defaultValue={v?.beds} />
          </Field>
          <Field label="Bathrooms" name="p-baths">
            <input id="p-baths" name="baths" inputMode="numeric" className={inputCls} defaultValue={v?.baths} />
          </Field>
          <Field label="Size" name="p-size">
            <input id="p-size" name="size" className={inputCls} defaultValue={v?.size} placeholder="For example, 180 sqm" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" name="p-description">
              <textarea id="p-description" name="description" rows={4} className={`${inputCls} py-3`} defaultValue={v?.description} />
            </Field>
          </div>

          {rent && (
            <fieldset className="grid grid-cols-1 gap-5 border-t border-line pt-5 sm:col-span-2 sm:grid-cols-2">
              <legend className="text-sm font-bold">Payment breakdown</legend>
              <p className="text-sm text-muted sm:col-span-2">
                What the tenant pays on top of the rent. The website adds these up and shows the total move-in cost.
              </p>
              <Field label="Agency fee paid by tenant" name="p-agency">
                <input id="p-agency" name="agencyFee" inputMode="numeric" className={inputCls} defaultValue={v?.costs?.agencyFee || ""} placeholder="Leave empty for none" />
              </Field>
              <Field label="Legal/agreement fee" name="p-legal">
                <input id="p-legal" name="legalFee" inputMode="numeric" className={inputCls} defaultValue={v?.costs?.legalFee || ""} placeholder="Leave empty for none" />
              </Field>
              <Field label="Caution deposit" name="p-caution">
                <select id="p-caution" name="cautionRate" className={inputCls} defaultValue={v?.costs?.cautionPct ? `${v.costs.cautionPct}%` : ""}>
                  <option value="">No caution deposit</option>
                  {CAUTION_RATES.map((r) => <option key={r} value={r}>{r} of the annual rent</option>)}
                </select>
              </Field>
              <Field label="Service charge per year" name="p-service">
                <input id="p-service" name="serviceCharge" inputMode="numeric" className={inputCls} defaultValue={v?.costs?.serviceCharge || ""} placeholder="Leave empty for none" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="What the service charge covers" name="p-covers">
                  <input id="p-covers" name="serviceCovers" className={inputCls} defaultValue={v?.serviceCovers} />
                </Field>
              </div>
            </fieldset>
          )}

          <fieldset className="border-t border-line pt-5 sm:col-span-2">
            <legend className="text-sm font-bold">Available facilities</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((f) => (
                <span key={f} className="relative">
                  <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line pl-4 text-sm font-medium has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:checked]:text-green ${can.edit ? "pr-10" : "pr-4"}`}>
                    <input
                      type="checkbox"
                      name="facilities"
                      value={f}
                      checked={chosen.includes(f)}
                      onChange={(e) => setChosen((c) => (e.target.checked ? [...c, f] : c.filter((x) => x !== f)))}
                      className="size-4 accent-green"
                    />
                    {f}
                  </label>
                  {can.edit && (
                    <button
                      type="button"
                      aria-label={`Remove ${f} from the list`}
                      onClick={async () => {
                        if (!window.confirm(`Remove "${f}" from the list? Properties that already have it keep it.`)) return;
                        const res = await removeFacility(f);
                        if (res.error) return setFacilityError(res.error);
                        // Leaves the tick as it is: this property keeps the facility.
                        setRemoved((r) => [...r, f]);
                        router.refresh();
                      }}
                      className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-muted transition hover:bg-red-50 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {can.edit &&
                (adding ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      id="new-facility"
                      value={facilityName}
                      onChange={(e) => {
                        setFacilityName(e.target.value);
                        setFacilityError("");
                      }}
                      onKeyDown={(e) => {
                        // Enter adds the facility; it must not submit the whole property form.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createFacility();
                        }
                      }}
                      maxLength={40}
                      autoFocus
                      aria-label="Name of the new facility"
                      aria-describedby={facilityError ? "facility-error" : undefined}
                      placeholder="For example, Swimming pool"
                      className="min-h-11 w-56 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                    />
                    <button type="button" onClick={createFacility} className={btnPrimary}>Add</button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setFacilityName("");
                        setFacilityError("");
                      }}
                      className="min-h-11 px-2 text-sm font-semibold text-muted underline underline-offset-4"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    id="create-facility"
                    onClick={() => setAdding(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-ink/25 px-4 text-sm font-semibold text-muted transition hover:border-green hover:text-green"
                  >
                    <Icon name="plus" className="size-4" /> Create facility
                  </button>
                ))}
            </div>
            {facilityError && <p id="facility-error" role="alert" className="mt-2 text-sm text-red-700">{facilityError}</p>}
          </fieldset>
          <Field label="Parking arrangements" name="p-parking">
            <input id="p-parking" name="parking" className={inputCls} defaultValue={v?.parking} />
          </Field>
          <Field label="Security arrangements" name="p-security">
            <input id="p-security" name="security" className={inputCls} defaultValue={v?.security} />
          </Field>
          <Field label="Inspection availability" name="p-inspection">
            <input id="p-inspection" name="inspection" className={inputCls} defaultValue={v?.inspection} />
          </Field>
          <Field label="Video link" name="p-video">
            <input id="p-video" name="video" className={inputCls} defaultValue={v?.video} placeholder="https://" />
          </Field>

          <div className="sm:col-span-2">
            <DetailFields
              fields={fields}
              values={v?.details}
              onAdd={async (field) => {
                const res = await addDetailField(field);
                if (!res.error) router.refresh();
                return res.error;
              }}
              onRemove={async (field) => {
                if (!window.confirm(`Remove "${field.label}" from every property and from the List Property form?`)) return;
                const res = await removeDetailField(field.id);
                if (res.error) setError(res.error);
                else router.refresh();
              }}
            />
          </div>

          <div className="sm:col-span-2">
            <p className="text-sm font-semibold">Photos</p>
            <p className="mt-1 text-sm text-muted">
              The first photo is the cover. The rest show on hover and in the detail view. Up to {MAX_PHOTOS}.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((path, i) => (
                <div key={path} className="relative aspect-square overflow-hidden rounded-xl bg-green/10">
                  <Image src={photoUrl(path)} alt={`Photo ${i + 1}`} fill sizes="160px" className="object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos((p) => p.filter((x) => x !== path))}
                    className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-white/95 text-coal text-lg leading-none"
                  >
                    ×
                  </button>
                  {i === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-coal">Cover</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => [path, ...p.filter((x) => x !== path)])}
                      className="absolute bottom-1 left-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-coal"
                    >
                      Make cover
                    </button>
                  )}
                </div>
              ))}
            </div>
            <PhotoDropzone inputId="p-photos" onFiles={addPhotos} busy={busy !== ""} remaining={MAX_PHOTOS - photos.length} max={MAX_PHOTOS} />
          </div>

          <label className="flex items-start gap-3 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" name="verified" defaultChecked={v?.verified} disabled={!can.publish} className="mt-0.5 size-5 shrink-0 accent-green" />
            <span>
              Owner verified
              <span className="block font-normal text-muted">
                Tick only after the landlord&apos;s identity and authority are checked, the property is inspected and availability is confirmed. The website then shows the &quot;Owner verified&quot; badge.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" name="published" defaultChecked={v ? v.published : can.publish} disabled={!can.publish} className="mt-0.5 size-5 shrink-0 accent-green" />
            <span>
              Published (visible on the website)
              {!can.publish && <span className="block font-normal text-muted">Your role saves drafts. Someone who can publish must put it on the website.</span>}
            </span>
          </label>
        </div>

        {error && <p id="p-error" role="alert" className="mt-5 text-sm font-medium text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button disabled={busy !== ""} className={btnPrimary}>{busy === "saving" ? "Saving…" : "Save property"}</button>
          <button type="button" id="preview-property" disabled={busy !== ""} onClick={() => setPreview(buildPreview())} className={btnGhost}>
            Preview on website
          </button>
          {v?.dbId && can.publish && (
            <button type="button" disabled={busy !== ""} onClick={onDelete} className={`${btnGhost} text-red-700`}>
              {busy === "deleting" ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </form>
      <section className="border-t border-line p-6 sm:p-8" aria-labelledby="owner-heading">
        <h3 id="owner-heading" className="text-lg font-bold">Owner and agreement</h3>
        {v?.dbId ? (
          <div className="mt-4">
            <OwnerPanel listingId={v.dbId} category={v.category} owner={v.owner} agreement={v.agreement} canApprove={can.approve} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Save the property first, then add the owner and record their agreement here.</p>
        )}
      </section>
      {preview && <PreviewDialog listing={preview} fields={fields} onClose={() => setPreview(null)} />}
    </dialog>
  );
}

export function PropertyManager({ listings, detailFields, facilities, can }: { listings: Listing[]; detailFields: DetailField[]; facilities: string[]; can: Can }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  // undefined: editor closed. null: adding a new property.
  const [editing, setEditing] = useState<Listing | null | undefined>(undefined);
  const shown = listings.filter((l) => filter === "All" || l.category === filter);

  return (
    <>
      <PageHeader
        title="Properties"
        text="The houses, land and shops shown on the website."
        action={
          can.edit && (
            <button type="button" onClick={() => setEditing(null)} className={btnPrimary}>
              <Icon name="plus" className="size-4" /> Add property
            </button>
          )
        }
      />
      <div role="tablist" aria-label="Filter by category" className="mb-5 flex gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={f === filter}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] ${
              f === filter ? "bg-ink text-ground" : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-muted">No properties here yet.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shown.map((l) => (
          <article key={l.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative aspect-[4/3] bg-green/10">
              {l.images[0] && <Image src={l.images[0]} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />}
              <span className="absolute left-3 top-3 flex gap-1.5">
                <Badge>{l.published ? "Published" : "Draft"}</Badge>
                {l.sample && <Badge>Sample</Badge>}
              </span>
            </div>
            <div className="p-4">
              <p className="text-lg font-extrabold tracking-tight">
                {l.price}
                {l.category === "Rent" && <span className="text-sm font-medium text-muted"> / year</span>}
              </p>
              <h2 className="mt-0.5 font-semibold">{l.title}</h2>
              <p className="text-sm text-muted">{l.location}</p>
              <p className="mt-2 text-sm text-muted">{[l.id, l.category, specs(l)].filter(Boolean).join(" · ")}</p>
              {can.edit && (
                <button type="button" onClick={() => setEditing(l)} className={`${btnGhost} mt-4 w-full`}>
                  <Icon name="edit" className="size-4" /> Edit
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {editing !== undefined && (
        <Editor key={editing?.id ?? "new"} listing={editing} fields={detailFields} facilities={facilities} can={can} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}

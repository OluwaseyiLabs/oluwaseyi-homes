"use client";

import { useState } from "react";
import { DetailInput } from "@/components/DetailInput";
import { inputCls } from "@/components/Field";
import { ASK_OWNER, DETAIL_TYPES, type AskOwner, type DetailField, type DetailType } from "@/lib/listings";
import { btnGhost } from "./ui";

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The extra details recorded for a property (caution fee, furnishing, and so
 * on), plus the small form that creates a new one. A detail left empty is not
 * shown on the website.
 */
export function DetailFields({
  fields,
  onAdd,
  onRemove,
  values,
}: {
  fields: DetailField[];
  /** Saves a new detail. Returns an error message, or null when it worked. */
  onAdd: (field: DetailField) => Promise<string | null>;
  onRemove: (field: DetailField) => void;
  values?: Record<string, string>;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<DetailType>("Text");
  const [options, setOptions] = useState("");
  const [ask, setAsk] = useState<AskOwner>("No");
  const [error, setError] = useState("");

  async function add() {
    const name = label.trim();
    const id = slug(name);
    const list = [...new Set(options.split(",").map((o) => o.trim()).filter(Boolean))];
    if (!id) return setError("Enter a title for the detail.");
    if (fields.some((f) => f.id === id)) return setError("A detail with that title already exists.");
    if (type === "Dropdown" && list.length < 2) return setError("Enter at least two options, separated by commas.");
    const failed = await onAdd({ id, label: name, type, askOwner: ask, ...(type === "Dropdown" ? { options: list } : {}) });
    if (failed) return setError(failed);
    setLabel("");
    setOptions("");
    setType("Text");
    setAsk("No");
    setError("");
  }

  return (
    <div>
      <p className="text-sm font-semibold">Additional details</p>
      <p className="mt-1 text-sm text-muted">
        Fill in what applies to this property. Anything left empty is not shown on the website.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`d-${f.id}`} className="text-sm font-semibold">
                {f.label} <span className="font-normal text-muted">({f.type.toLowerCase()})</span>
              </label>
              <button
                type="button"
                onClick={() => onRemove(f)}
                aria-label={`Remove the ${f.label} detail from all properties`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none text-red-700 transition hover:bg-red-50"
              >
                ×
              </button>
            </div>
            <DetailInput field={f} id={`d-${f.id}`} defaultValue={values?.[f.id]} />
            {f.askOwner !== "No" && (
              <p className="mt-1.5 text-xs text-muted">
                Landlords are asked for this when listing {f.askOwner === "Both" ? "to rent or sell" : `to ${f.askOwner.toLowerCase()}`}.
              </p>
            )}
          </div>
        ))}
      </div>

      <fieldset className="mt-6 rounded-2xl border border-line bg-panel p-4">
        <legend className="px-1 text-sm font-semibold">Create a new detail</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-detail-title" className="text-sm font-semibold">Title</label>
            <input
              id="new-detail-title"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError("");
              }}
              placeholder="For example, Agreement fee"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-detail-error" : undefined}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="new-detail-type" className="text-sm font-semibold">Kind of answer</label>
            <select
              id="new-detail-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as DetailType);
                setError("");
              }}
              className={inputCls}
            >
              {DETAIL_TYPES.map((t) => (
                <option key={t} value={t}>{t === "Date" ? "Date (calendar)" : t}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-detail-ask" className="text-sm font-semibold">Ask landlords for this in the List Property form</label>
            <select id="new-detail-ask" value={ask} onChange={(e) => setAsk(e.target.value as AskOwner)} className={inputCls}>
              {ASK_OWNER.map((a) => (
                <option key={a} value={a}>
                  {a === "No" ? "No, only I fill it in" : a === "Both" ? "Yes, for rent and sale listings" : `Yes, for listings to ${a.toLowerCase()}`}
                </option>
              ))}
            </select>
          </div>
          {type === "Dropdown" && (
            <div className="sm:col-span-2">
              <label htmlFor="new-detail-options" className="text-sm font-semibold">Dropdown options</label>
              <input
                id="new-detail-options"
                value={options}
                onChange={(e) => {
                  setOptions(e.target.value);
                  setError("");
                }}
                placeholder="Separate with commas, for example: Monthly, Quarterly, Yearly"
                className={inputCls}
              />
            </div>
          )}
        </div>
        {error && <p id="new-detail-error" className="mt-2 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={add} className={`${btnGhost} mt-4 bg-surface`}>Add detail</button>
      </fieldset>
    </div>
  );
}

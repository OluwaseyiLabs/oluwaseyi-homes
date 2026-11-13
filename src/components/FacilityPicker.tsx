/** Tick boxes for facilities. The value is the chosen names joined by commas. */
export function FacilityPicker({
  legend,
  hint,
  idPrefix,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  idPrefix: string;
  /** The facilities to offer. */
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const chosen = value.split(",").filter(Boolean);
  const toggle = (f: string) =>
    onChange(options.filter((x) => (x === f ? !chosen.includes(f) : chosen.includes(x))).join(","));

  return (
    <fieldset>
      <legend className="text-sm font-semibold">
        {legend}
        <span className="font-normal text-muted"> (optional)</span>
      </legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((f, i) => (
          <label
            key={f}
            htmlFor={`${idPrefix}-${i}`}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium transition has-[:checked]:border-green has-[:checked]:bg-green/10 has-[:checked]:text-green has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green/30"
          >
            <input
              id={`${idPrefix}-${i}`}
              type="checkbox"
              checked={chosen.includes(f)}
              onChange={() => toggle(f)}
              className="size-4 accent-green"
            />
            {f}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

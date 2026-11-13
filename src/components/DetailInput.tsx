import type { DetailField } from "@/lib/listings";
import { inputCls } from "./Field";

/**
 * The input for one additional detail, chosen by its type. Pass `value` and
 * `onChange` to control it, or `defaultValue` to leave it uncontrolled.
 */
export function DetailInput({
  field,
  id,
  value,
  defaultValue,
  onChange,
}: {
  field: DetailField;
  id: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const shared = {
    id,
    className: inputCls,
    ...(onChange
      ? { value: value ?? "", onChange: (e: { target: { value: string } }) => onChange(e.target.value) }
      : { defaultValue: defaultValue ?? "" }),
  };
  const choices = field.type === "Yes or no" ? ["Yes", "No"] : field.options;
  if (choices) {
    return (
      <select {...shared}>
        <option value="">Not set</option>
        {choices.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      {...shared}
      type={field.type === "Date" ? "date" : "text"}
      inputMode={field.type === "Number" ? "numeric" : undefined}
    />
  );
}

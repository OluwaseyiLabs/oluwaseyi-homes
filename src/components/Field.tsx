export const inputCls =
  "mt-2 block min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none transition focus:border-green focus:ring-2 focus:ring-green/20 aria-[invalid=true]:border-red-600";

export function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
        {required ? "" : <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

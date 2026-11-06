import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  label: ReactNode;
  value: string;
  error?: string;
  hint?: string;
  /** Tampilkan penghitung karakter dan batas minimal. */
  minChars?: number;
};

export default function TextArea({
  label,
  value,
  error,
  hint,
  minChars,
  rows = 4,
  ...rest
}: Props) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
      <textarea
        id={id}
        rows={rows}
        value={value}
        aria-invalid={!!error}
        className={`w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:border-brand-700 focus:ring-brand-700/20"
        }`}
        {...rest}
      />
      <div className="flex items-start justify-between gap-3 text-sm">
        <p className="text-red-600">{error}</p>
        {minChars !== undefined && (
          <p className="ml-auto shrink-0 text-gray-500">
            {value.trim().length} karakter · Minimal {minChars}
          </p>
        )}
      </div>
    </div>
  );
}

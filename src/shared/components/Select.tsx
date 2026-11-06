import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  placeholder: string;
  options: readonly string[];
  error?: string;
  hint?: string;
};

export default function Select({
  label,
  placeholder,
  options,
  error,
  hint,
  className = "",
  ...rest
}: Props) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error}
          className={`h-11 w-full appearance-none rounded-lg border bg-white pl-3.5 pr-10 text-[15px] outline-none transition focus:ring-2 ${
            rest.value ? "text-gray-900" : "text-gray-400"
          } ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:border-brand-700 focus:ring-brand-700/20"
          } ${className}`}
          {...rest}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-gray-900">
              {o}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

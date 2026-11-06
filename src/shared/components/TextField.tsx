import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
  hint?: string;
};

export default function TextField({
  label,
  error,
  hint,
  type = "text",
  ...rest
}: Props) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          aria-invalid={!!error}
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-[15px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:border-brand-700 focus:ring-brand-700/20"
          } ${isPassword ? "pr-20" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={
              show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            className="absolute inset-y-0 right-0 px-3.5 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            {show ? "Sembunyi" : "Lihat"}
          </button>
        )}
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
  loading?: boolean;
};

export default function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: Props) {
  const base =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-brand-800 text-white hover:bg-brand-700"
      : "border border-brand-800 bg-white text-brand-800 hover:bg-brand-50";

  return (
    <button
      className={`${base} ${styles} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

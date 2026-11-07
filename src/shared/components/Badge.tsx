import type { ReactNode } from "react";

const TONES = {
  green: "bg-brand-700 text-white",
  soft: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-700/30",
  amber: "bg-tag text-brand-950",
  red: "bg-red-600 text-white",
  redSoft: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  gray: "bg-gray-500 text-white",
  graySoft: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  outline: "bg-white text-brand-800 ring-1 ring-inset ring-brand-700",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function Badge({
  tone = "soft",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

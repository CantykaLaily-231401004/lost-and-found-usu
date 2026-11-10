import type { ReactNode } from "react";

export default function PageBanner({
  eyebrow,
  title,
  subtitle,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="panel-green relative overflow-hidden rounded-3xl px-5 py-5 text-white shadow-[0_20px_50px_-20px_rgba(12,51,33,0.5)] sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/75">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

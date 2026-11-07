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
    <section className="panel-green overflow-hidden rounded-2xl px-5 py-6 text-white sm:px-7 sm:py-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
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

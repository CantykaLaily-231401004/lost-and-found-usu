import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon, { type IconName } from "../../shared/components/Icon";
import { card } from "./adminstyles";

export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-800">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-1 text-[15px] text-gray-600">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  icon,
  to,
  linkLabel,
  children,
}: {
  title: string;
  icon: IconName;
  to?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2.5 font-display text-base font-semibold text-gray-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
            <Icon name={icon} className="size-[18px]" />
          </span>
          {title}
        </h2>
        {to && (
          <Link
            to={to}
            className="text-[13px] font-medium text-brand-800 hover:underline"
          >
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

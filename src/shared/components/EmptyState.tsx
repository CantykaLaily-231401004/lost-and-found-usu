import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

export default function EmptyState({
  icon = "file",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-800/25 bg-white/60 px-6 py-8 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-800 ring-1 ring-brand-800/10">
        <Icon name={icon} className="size-5" />
      </span>
      <h2 className="mt-3 font-display text-base font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-600">
        {body}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

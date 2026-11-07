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
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        <Icon name={icon} className="size-6" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-gray-600">
        {body}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

import type { ReactNode } from "react";
import Icon from "./Icon";

export default function Alert({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "error";
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-tag/60 bg-tag/15 text-brand-950"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div
      role={tone === "error" ? "alert" : "note"}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-6 ${styles}`}
    >
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

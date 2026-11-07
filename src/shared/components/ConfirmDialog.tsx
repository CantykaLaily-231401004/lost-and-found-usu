import { useEffect, type ReactNode } from "react";
import Button from "./Button";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-brand-950/50 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="dlg-title" className="font-display text-xl font-semibold text-gray-900">
          {title}
        </h2>
        <div className="mt-3 space-y-4 text-sm text-gray-600">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} className="sm:w-auto!">
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={`sm:w-auto! ${danger ? "bg-red-600! hover:bg-red-500!" : ""}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

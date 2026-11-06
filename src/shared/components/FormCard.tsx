import type { ReactNode } from "react";

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 border-b border-gray-200 px-5 py-6 last:border-b-0 sm:px-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 rounded text-sm text-gray-700 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        ← Kembali
      </button>
    </div>
  );
}

import type { ReactNode } from "react";

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-clip rounded-2xl border border-white/80 bg-white/90 shadow-sm">
      {children}
    </div>
  );
}

export function FormSection({
  title,
  step,
  children,
}: {
  title: ReactNode;
  step?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 border-b border-gray-200/80 px-5 py-5 last:border-b-0 sm:px-6">
      <h3 className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
        {step !== undefined && (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-bold text-white">
            {step}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-gray-200/80 bg-white/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:px-6">
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
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-1 text-[15px] text-gray-600">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 rounded-full border border-brand-800/25 bg-white/70 px-4 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        ← Kembali
      </button>
    </div>
  );
}

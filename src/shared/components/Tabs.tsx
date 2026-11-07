type Item<T extends string> = { value: T; label: string; count?: number };

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "segment",
  label,
}: {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: "segment" | "pill";
  label: string;
}) {
  const wrap =
    variant === "segment"
      ? "grid rounded-xl bg-gray-100 p-1"
      : "flex flex-wrap gap-2";
  return (
    <div
      role="tablist"
      aria-label={label}
      className={wrap}
      style={
        variant === "segment"
          ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {items.map((it) => {
        const active = it.value === value;
        const cls =
          variant === "segment"
            ? active
              ? "bg-white text-brand-800 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
            : active
              ? "bg-brand-800 text-white"
              : "border border-gray-300 bg-white text-gray-700 hover:border-brand-700";
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 ${
              variant === "pill" ? "rounded-full" : ""
            } ${cls}`}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${
                  active && variant === "pill"
                    ? "bg-white/20 text-white"
                    : active
                      ? "bg-brand-800 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from "react";
import Icon, { type IconName } from "../../shared/components/Icon";

type Item = { icon: IconName; title: string; place: string };

const ITEMS: Item[] = [
  { icon: "key", title: "Kunci motor", place: "Fasilkom-TI" },
  { icon: "card", title: "Kartu mahasiswa", place: "Perpustakaan" },
  { icon: "bag", title: "Tas ransel", place: "Fakultas Teknik" },
  { icon: "laptop", title: "Charger laptop", place: "FMIPA" },
];

function Card({ index, className }: { index: number; className: string }) {
  const item = ITEMS[index];
  return (
    <div
      className={`absolute inset-0 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-tag text-brand-950">
          <Icon name={item.icon} className="size-5" />
        </span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90">
          Ditemukan
        </span>
      </div>
      <p className="mt-3 font-display text-sm font-bold text-white">
        {item.title}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-white/65">
        <Icon name="pin" className="size-3 shrink-0" />
        {item.place}
      </p>
      <div className="mt-3 flex gap-1">
        {ITEMS.map((_, n) => (
          <span
            key={n}
            className={`h-1 rounded-full ${
              n === index ? "w-4 bg-tag" : "w-1.5 bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HangingTag() {
  const [state, setState] = useState<{ cur: number; prev: number | null }>({
    cur: 0,
    prev: null,
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setState((s) => ({ cur: (s.cur + 1) % ITEMS.length, prev: s.cur }));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-6 top-1/2 hidden w-52 -translate-y-1/2 lg:block xl:right-10"
    >
      <div className="float relative h-36">
        <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-3 rounded-2xl border border-white/10 bg-white/5" />
        {state.prev !== null && (
          <Card
            key={`o${state.prev}-${state.cur}`}
            index={state.prev}
            className="slide-out"
          />
        )}
        <Card key={`i${state.cur}`} index={state.cur} className="slide-in" />
      </div>
    </div>
  );
}

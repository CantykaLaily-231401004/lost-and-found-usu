import type { ReactNode } from "react";

// Isi nanti: import logo from "../../assets/logo.png"  lalu  const LOGO_SRC = logo
const LOGO_SRC = undefined as string | undefined;
// Isi nanti: import campus from "../../assets/campus.jpg"  lalu  const PHOTO_SRC = campus
const PHOTO_SRC = undefined as string | undefined;

const steps = [
  "Laporkan barang hilang atau temuan",
  "Cari berdasarkan ciri dan lokasi",
  "Klaim dengan ciri rahasia, lalu atur serah terima",
];

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className="flex items-center gap-3">
      {LOGO_SRC ? (
        <img
          src={LOGO_SRC}
          alt="Logo LoFi USU"
          className="size-12 object-contain"
        />
      ) : (
        <div
          className={`flex size-12 items-center justify-center rounded-xl border border-dashed text-xs ${
            dark
              ? "border-brand-800/40 text-brand-800/70"
              : "border-white/40 text-white/70"
          }`}
        >
          Logo
        </div>
      )}
      <div className="leading-tight">
        <p
          className={`font-display text-lg font-bold ${dark ? "text-brand-950" : "text-white"}`}
        >
          LoFi USU
        </p>
        <p className={`text-xs ${dark ? "text-gray-500" : "text-white/70"}`}>
          Sistem Informasi Barang Kampus
        </p>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="panel-green hidden flex-col overflow-hidden px-10 py-8 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="shrink-0">
          <Logo tone="light" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center pt-4">
          <div className="tag-swing flex min-h-0 w-full max-w-[22rem] flex-1 flex-col items-center">
            {/* tali */}
            <span className="h-[clamp(1rem,4vh,2.5rem)] w-px shrink-0 bg-white/50" />

            {/* tag */}
            <div
              className="relative flex min-h-0 w-full flex-1 flex-col bg-tag px-[clamp(1rem,2.4vh,1.75rem)] pb-[clamp(1rem,2.4vh,1.75rem)] pt-[clamp(1.25rem,4vh,2.75rem)] text-brand-950"
              style={{
                clipPath:
                  "polygon(12% 0, 88% 0, 100% 7%, 100% 100%, 0 100%, 0 7%)",
              }}
            >
              <span className="absolute left-1/2 top-[clamp(0.5rem,1.6vh,1rem)] size-3 -translate-x-1/2 rounded-full bg-brand-950" />

              {PHOTO_SRC ? (
                <img
                  src={PHOTO_SRC}
                  alt=""
                  className="min-h-[4rem] w-full flex-1 rounded-xl object-cover"
                />
              ) : (
                <div className="flex min-h-[4rem] w-full flex-1 items-center justify-center rounded-xl border-2 border-dashed border-brand-950/30 bg-brand-950/10 text-sm font-medium text-brand-950/60">
                  Foto kampus
                </div>
              )}

              <h1 className="mt-[clamp(0.5rem,2vh,1.25rem)] shrink-0 font-display text-[clamp(1.1rem,3.2vh,1.75rem)] font-bold leading-tight">
                Barang hilang di kampus, kembali ke pemiliknya.
              </h1>

              <ol className="mt-[clamp(0.5rem,1.8vh,1rem)] shrink-0 space-y-[clamp(0.25rem,1vh,0.6rem)] text-[clamp(0.75rem,1.9vh,0.95rem)]">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-3">
                    <span className="flex size-[clamp(1.25rem,3vh,1.75rem)] shrink-0 items-center justify-center rounded-full bg-brand-950 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </aside>

      <main className="paper flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo tone="dark" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

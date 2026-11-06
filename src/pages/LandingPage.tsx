import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../shared/components/AuthLayout";

// Isi nanti: import campus from "../assets/campus.jpg"  lalu  const PHOTO_SRC = campus
const PHOTO_SRC = undefined as string | undefined;

const steps = [
  {
    title: "Laporkan",
    body: "Catat barang hilang atau temuan lengkap dengan kategori, lokasi, dan foto.",
  },
  {
    title: "Cari",
    body: "Telusuri laporan berdasarkan kategori, area kampus, warna, dan merek.",
  },
  {
    title: "Klaim dan ambil",
    body: "Pemilik membuktikan kepemilikan lewat ciri yang hanya ia ketahui, lalu admin menjadwalkan serah terima.",
  },
];

const items = [
  "dompet",
  "kunci motor",
  "kartu mahasiswa",
  "tumbler",
  "charger",
  "payung",
];

function RotatingWord() {
  const [state, setState] = useState<{ cur: number; prev: number | null }>({
    cur: 0,
    prev: null,
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setState((s) => ({ cur: (s.cur + 1) % items.length, prev: s.cur }));
    }, 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="relative -my-[0.08em] inline-block overflow-hidden py-[0.08em] align-bottom">
      <span className="invisible">kartu mahasiswa</span>
      {state.prev !== null && (
        <span
          key={`o${state.prev}-${state.cur}`}
          aria-hidden
          className="word-out absolute inset-x-0 top-[0.08em]"
        >
          {items[state.prev]}
        </span>
      )}
      <span
        key={`i${state.cur}`}
        className="word-in absolute inset-x-0 top-[0.08em]"
      >
        {items[state.cur]}
      </span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="paper min-h-screen text-gray-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo tone="dark" />
        <nav className="flex items-center gap-2 text-sm font-medium">
          <a
            href="#cara-kerja"
            className="hidden rounded-lg px-3 py-2 text-gray-600 hover:text-gray-900 sm:block"
          >
            Cara kerja
          </a>
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-brand-800 hover:bg-brand-50"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-brand-800 px-4 py-2 text-white hover:bg-brand-700"
          >
            Daftar
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-brand-950 sm:text-5xl lg:text-6xl">
              <span className="rise block">Kehilangan atau menemukan</span>
              <span className="block">
                <RotatingWord />
              </span>
              <span className="rise block" style={{ animationDelay: "0.15s" }}>
                di kampus?
              </span>
            </h1>
            <p
              className="rise mt-6 max-w-lg text-lg leading-8 text-gray-600"
              style={{ animationDelay: "0.3s" }}
            >
              LoFi USU mempertemukan barang hilang dan barang temuan di seluruh
              area Universitas Sumatera Utara.
            </p>
            <div
              className="rise mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: "0.45s" }}
            >
              <Link
                to="/login"
                className="inline-flex h-12 items-center rounded-lg bg-brand-800 px-6 font-medium text-white hover:bg-brand-700"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="inline-flex h-12 items-center rounded-lg border border-brand-800 px-6 font-medium text-brand-800 hover:bg-brand-50"
              >
                Buat akun
              </Link>
            </div>
            <p
              className="rise mt-4 text-sm text-gray-500"
              style={{ animationDelay: "0.6s" }}
            >
              Untuk mahasiswa dan staf USU dengan surel kampus.
            </p>
          </div>

          {PHOTO_SRC ? (
            <img
              src={PHOTO_SRC}
              alt=""
              className="aspect-[4/3] w-full rounded-3xl object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border-2 border-dashed border-brand-800/30 bg-brand-50 text-sm font-medium text-brand-800/60">
              Foto kampus
            </div>
          )}
        </section>

        <section id="cara-kerja" className="bg-brand-950 px-6 py-20 text-white">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Tiga langkah sampai barang kembali
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="flex size-9 items-center justify-center rounded-full bg-tag font-display text-base font-bold text-brand-950">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold">
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-7 text-white/70">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-brand-950">
              Klaim yang aman
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              Pendaftaran hanya untuk surel @students.usu.ac.id dan @usu.ac.id.
              Ciri rahasia barang temuan tidak ditampilkan ke pengguna biasa,
              sehingga hanya pemilik sebenarnya yang bisa mengklaim.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8 text-center text-sm text-gray-500">
        LoFi USU, proyek mata kuliah Proyek Perangkat Lunak, Universitas
        Sumatera Utara.
      </footer>
    </div>
  );
}

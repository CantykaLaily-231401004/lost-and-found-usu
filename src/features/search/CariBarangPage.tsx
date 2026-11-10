import { useMemo, useState } from "react";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import PageBanner from "../../shared/components/PageBanner";
import Tabs from "../../shared/components/Tabs";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { categoryLabel, useLofiStore } from "../../shared/store/lofiStore";
import { CATEGORIES } from "../../shared/utils/reportOptions";
import ReportCard from "./ReportCard";
import HangingTag from "./HangingTag";

type Tab = "semua" | "found" | "lost";

export default function CariBarangPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("semua");
  const [category, setCategory] = useState("");
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);

  const catalog = useMemo(
    () =>
      store.reports
        .filter((r) => r.status !== "Ditutup")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.reports],
  );

  const counts = {
    semua: catalog.length,
    found: catalog.filter((r) => r.kind === "found").length,
    lost: catalog.filter((r) => r.kind === "lost").length,
  };
  const stats = [
    {
      n: catalog.filter((r) => r.kind === "found" && r.status === "Tersedia")
        .length,
      label: "Barang Tersedia",
    },
    {
      n: catalog.filter(
        (r) => r.kind === "found" && new Date(r.createdAt).getTime() >= weekAgo,
      ).length,
      label: "Temuan Baru",
    },
    {
      n: catalog.filter((r) => r.kind === "lost" && r.status === "Aktif")
        .length,
      label: "Laporan Aktif",
    },
  ];

  const q = query.trim().toLowerCase();
  const shown = catalog.filter((r) => {
    if (tab !== "semua" && r.kind !== tab) return false;
    if (category && r.category !== category) return false;
    if (!q) return true;
    return [
      r.description,
      r.location,
      r.area,
      r.brand,
      r.color,
      categoryLabel(r),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  function reset() {
    setQuery("");
    setTab("semua");
    setCategory("");
  }

  return (
    <AppShell wide>
      <PageBanner
        title="Temukan Barang Anda"
        subtitle="Cari barang temuan di seluruh lingkungan kampus USU"
      >
        <HangingTag />
        <div className="lg:pr-60">
          <label className="mt-4 block">
            <span className="sr-only">Cari barang</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari berdasarkan deskripsi, lokasi, merek..."
              className="h-10 w-full rounded-xl border border-white/25 bg-white/10 px-4 text-[15px] text-white outline-none placeholder:text-white/60 focus:border-white/60 focus:ring-2 focus:ring-white/20"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80"
              >
                <strong className="text-sm font-bold text-white">{s.n}</strong>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </PageBanner>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pill"
          label="Jenis laporan"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua Barang", count: counts.semua },
            { value: "found", label: "Temuan", count: counts.found },
            { value: "lost", label: "Kehilangan", count: counts.lost },
          ]}
        />
        <select
          aria-label="Kategori"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 w-full rounded-full border border-gray-300 bg-white px-3.5 text-sm text-gray-700 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20 sm:w-44"
        >
          <option value="">Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {shown.length === 0 ? (
          <EmptyState
            icon="search"
            title="Tidak ada laporan yang sesuai"
            body="Coba kata kunci lain, ganti kategori, atau atur ulang pencarian."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="h-9 w-auto! px-4 text-sm"
              >
                Atur ulang pencarian
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">{shown.length} laporan</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((r, idx) => (
                <div
                  key={r.id}
                  className="rise [&>article]:h-full"
                  style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
                >
                  <ReportCard
                    report={r}
                    mine={r.ownerId === user?.id}
                    claimed={store.claims.some(
                      (c) =>
                        c.ownerId === user?.id &&
                        c.reportId === r.id &&
                        (c.status === "Menunggu" || c.status === "Disetujui"),
                    )}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

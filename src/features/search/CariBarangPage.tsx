import { useEffect, useEffectEvent, useRef, useState, type SelectHTMLAttributes } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import PageBanner from "../../shared/components/PageBanner";
import Tabs from "../../shared/components/Tabs";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { useLofiStore, type ReportStatus } from "../../shared/store/lofiStore";
import { CATEGORIES } from "../../shared/utils/reportOptions";
import { fetchAreas, type Area } from "../../services/areas";
import { errorMessage } from "../../services/rpc";
import {
  searchReports,
  type SearchResult,
  type SearchStatus,
} from "../../services/search";
import ReportCard from "./ReportCard";
import HangingTag from "./HangingTag";

type Tab = "semua" | "found" | "lost";

const STATUS_OPTIONS: Record<Tab, ReportStatus[]> = {
  semua: ["Aktif", "Tersedia", "Dicadangkan", "Diserahkan", "Ditutup"],
  found: ["Tersedia", "Dicadangkan", "Diserahkan", "Ditutup"],
  lost: ["Aktif", "Ditutup"],
};

const KEYWORD_DELAY = 400;

function FilterSelect({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0 flex-1 basis-[40%] sm:w-44 sm:flex-none sm:basis-auto lg:w-36">
      <select
        {...rest}
        className="h-9 w-full appearance-none truncate rounded-full border border-gray-300 bg-white pl-3.5 pr-9 text-sm text-gray-700 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20"
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  );
}

const PAGE_BUTTON_CLASS =
  "inline-flex size-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:border-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50";

export default function CariBarangPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();

  const [params, setParams] = useSearchParams();
  const tabParam = params.get("jenis");
  const tab: Tab = tabParam === "found" || tabParam === "lost" ? tabParam : "semua";
  const keyword = params.get("q") ?? "";
  const category = params.get("kategori") ?? "";
  const areaId = params.get("area") ?? "";
  const statusParam = params.get("status") ?? "";
  const status: SearchStatus =
    statusParam === "semua" || (STATUS_OPTIONS[tab] as string[]).includes(statusParam)
      ? (statusParam as SearchStatus)
      : "";
  const page = Math.max(1, Number(params.get("hal")) || 1);

  function update(changes: Record<string, string>, keepPage = false) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!keepPage) next.delete("hal");
        return next;
      },
      { replace: true },
    );
  }

  const commitKeyword = useEffectEvent((q: string) => update({ q }));
  const goToLastPage = useEffectEvent((last: number) => update({ hal: String(last) }, true));

  const [query, setQuery] = useState(keyword);
  const [reloadKey, setReloadKey] = useState(0);

  const [areas, setAreas] = useState<Area[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [doneKey, setDoneKey] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchAreas()
      .then(setAreas)
      .catch(() => setAreas([]));
  }, []);

  useEffect(() => {
    const next = query.trim();
    if (next === keyword) return;
    const t = setTimeout(() => commitKeyword(next), KEYWORD_DELAY);
    return () => clearTimeout(t);
  }, [query, keyword]);

  const requestKey = JSON.stringify([tab, keyword, category, areaId, status, page, reloadKey]);

  useEffect(() => {
    let active = true;
    searchReports({ kind: tab, keyword, category, areaId, status, page })
      .then((r) => {
        if (!active) return;
        if (r.items.length === 0 && r.total > 0 && page > r.totalPages) {
          goToLastPage(r.totalPages);
          return;
        }
        setResult(r);
        setLoadError("");
        setDoneKey(requestKey);
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(errorMessage(e));
        setDoneKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [requestKey, tab, keyword, category, areaId, status, page]);

  function changeTab(next: Tab) {
    const keepStatus = status === "semua" || (STATUS_OPTIONS[next] as string[]).includes(status);
    update({ jenis: next === "semua" ? "" : next, status: keepStatus ? status : "" });
  }

  const topRef = useRef<HTMLDivElement>(null);

  function goToPage(next: number) {
    update({ hal: next > 1 ? String(next) : "" }, true);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filterActive = category !== "" || areaId !== "" || status !== "";

  function resetFilters() {
    update({ kategori: "", area: "", status: "" });
  }

  function reset() {
    setQuery("");
    update({ q: "", jenis: "", kategori: "", area: "", status: "" });
  }

  const stats = [
    { n: result?.stats.available ?? 0, label: "Barang Tersedia" },
    { n: result?.stats.newFound ?? 0, label: "Temuan Baru" },
    { n: result?.stats.activeLost ?? 0, label: "Laporan Aktif" },
  ];
  const loading = doneKey !== requestKey;
  const failed = !loading && loadError !== "";

  return (
    <AppShell wide>
      <div ref={topRef} />
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
              maxLength={100}
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
          onChange={changeTab}
          items={[
            { value: "semua", label: "Semua Barang", count: result?.counts.semua },
            { value: "found", label: "Temuan", count: result?.counts.found },
            { value: "lost", label: "Kehilangan", count: result?.counts.lost },
          ]}
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <FilterSelect
            aria-label="Kategori"
            value={category}
            onChange={(e) => update({ kategori: e.target.value })}
          >
            <option value="">Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            aria-label="Area Kampus"
            value={areaId}
            onChange={(e) => update({ area: e.target.value })}
          >
            <option value="">Area Kampus</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            aria-label="Status"
            value={status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="">Status</option>
            <option value="semua">Semua status</option>
            {STATUS_OPTIONS[tab].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FilterSelect>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!filterActive}
            aria-label="Atur ulang filter"
            title="Atur ulang filter"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:border-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="refresh" className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {failed ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}{" "}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="font-medium underline"
            >
              Coba lagi
            </button>
          </p>
        ) : !result ? (
          <p className="text-sm text-gray-500">Memuat laporan...</p>
        ) : result.total === 0 && !loading ? (
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
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <p className="mb-3 text-sm text-gray-600">
              {result.total} laporan
              {loading && <span className="ml-2 text-gray-500">Memuat...</span>}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.items.map((r, idx) => (
                <div
                  key={r.id}
                  className="rise [&>article]:h-full"
                  style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
                >
                  <ReportCard
                    report={r}
                    mine={r.mine}
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
            {result.totalPages > 1 && (
              <nav
                aria-label="Navigasi halaman"
                className="mt-6 flex items-center justify-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  aria-label="Halaman sebelumnya"
                  title="Halaman sebelumnya"
                  className={PAGE_BUTTON_CLASS}
                >
                  <Icon name="chevronLeft" className="size-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Halaman {result.page} dari {result.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= result.totalPages || loading}
                  aria-label="Halaman berikutnya"
                  title="Halaman berikutnya"
                  className={PAGE_BUTTON_CLASS}
                >
                  <Icon name="chevronRight" className="size-4" />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
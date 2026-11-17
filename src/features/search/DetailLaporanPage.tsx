import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import { PageHeader } from "../../shared/components/FormCard";
import Icon from "../../shared/components/Icon";
import ReportThumb, {
  ReportKindBadge,
  ReportStatusBadge,
} from "../../shared/components/ReportThumb";
import { categoryLabel } from "../../shared/store/lofiStore";
import { formatDate, formatDateTimeWIB } from "../../shared/utils/format";
import type { CatalogReport } from "../../services/mappers";
import { errorMessage } from "../../services/rpc";
import {
  getCatalogReport,
  getReportTimeline,
  type TimelineEvent,
  type TimelineItem,
} from "../../services/search";

const EVENT_LABEL: Record<TimelineEvent, string> = {
  dilaporkan: "Dilaporkan",
  diperbarui: "Diperbarui oleh pelapor",
  dicadangkan: "Dicadangkan (klaim disetujui)",
  tersedia_kembali: "Tersedia kembali",
  diserahkan: "Diserahkan kepada pemilik",
  ditutup: "Ditutup",
};

type Loaded = { key: string; report: CatalogReport | null; error: string };

export default function DetailLaporanPage() {
  const { kode = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<{ kode: string; items: TimelineItem[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const requestKey = `${kode}|${reloadKey}`;
  useEffect(() => {
    let active = true;
    getCatalogReport(kode)
      .then((report) => active && setLoaded({ key: requestKey, report, error: "" }))
      .catch(
        (e) => active && setLoaded({ key: requestKey, report: null, error: errorMessage(e) }),
      );
    return () => {
      active = false;
    };
  }, [kode, requestKey]);

  function goBack() {
    if (location.key === "default") navigate("/cari");
    else navigate(-1);
  }

  async function toggleHistory() {
    if (historyOpen) return setHistoryOpen(false);
    setHistoryOpen(true);
    if (history?.kode === kode) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setHistory({ kode, items: await getReportTimeline(kode) });
    } catch (e) {
      setHistoryError(errorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  const loading = !loaded || loaded.key !== requestKey;
  const report = loading ? null : loaded.report;

  let body;
  if (loading) {
    body = <p className="text-sm text-gray-500">Memuat laporan...</p>;
  } else if (loaded.error) {
    body = (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {loaded.error}{" "}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="font-medium underline"
        >
          Coba lagi
        </button>
      </p>
    );
  } else if (!report) {
    body = (
      <EmptyState
        icon="search"
        title="Laporan tidak ditemukan"
        body="Kode laporan tidak ada di katalog, atau akun Anda belum terverifikasi."
        action={
          <Link to="/cari">
            <Button
              type="button"
              variant="outline"
              className="h-9! w-auto! px-4! text-[13px]!"
            >
              Kembali ke Cari Barang
            </Button>
          </Link>
        }
      />
    );
  } else {
    const lost = report.kind === "lost";
    const claimable = report.kind === "found" && report.status === "Tersedia" && !report.mine;
    const when = `${formatDate(report.date)}${report.time ? `, ${report.time.replace(":", ".")} WIB` : ""}`;
    const rows: [string, string][] = [
      ["Kategori", categoryLabel(report)],
      ["Warna", report.color || "-"],
      ["Merek", report.brand || "-"],
      ["Area kampus", report.area || "-"],
      [lost ? "Lokasi terakhir" : "Lokasi ditemukan", report.location],
      [lost ? "Waktu kehilangan" : "Waktu ditemukan", when],
      ["Dilaporkan", formatDateTimeWIB(report.createdAt)],
    ];

    body = (
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_19rem]">
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-sm">
          {report.photos.length > 0 ? (
            <div
              className={`grid gap-1 ${report.photos.length > 1 ? "grid-cols-2 sm:grid-cols-3" : ""}`}
            >
              {report.photos.map((src, i) => (
                <img
                  key={report.photoIds?.[i] ?? src}
                  src={src}
                  alt={`Foto ${i + 1}: ${report.description}`}
                  className="h-56 w-full object-cover"
                />
              ))}
            </div>
          ) : (
            <ReportThumb report={report} className="h-40 w-full" iconClass="size-12" />
          )}

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <ReportKindBadge kind={report.kind} />
              <ReportStatusBadge status={report.status} />
            </div>
            <p className="whitespace-pre-line text-[15px] leading-6 text-gray-900">
              {report.description}
            </p>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-2">
          <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            {report.mine ? (
              <p className="text-center text-sm font-medium text-brand-800">Laporan Anda</p>
            ) : claimable ? (
              <Link
                to={`/klaim/baru/${report.kode}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-800 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
              >
                <Icon name="clipboard" className="size-4" />
                Ajukan Klaim
              </Link>
            ) : lost && report.status === "Aktif" ? (
              <p className="flex items-center justify-center gap-2 text-sm text-red-600">
                <span className="size-1.5 rounded-full bg-red-600" />
                Sedang dicari pemiliknya
              </p>
            ) : (
              <p className="text-center text-sm text-gray-600">
                Laporan ini berstatus {report.status}.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <button
              type="button"
              onClick={toggleHistory}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between text-sm font-medium text-brand-800"
            >
              {historyOpen ? "Sembunyikan riwayat" : "Lihat riwayat"}
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className={`size-4 transition ${historyOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            {historyOpen && (
              <div className="mt-3">
                {historyLoading ? (
                  <p className="text-sm text-gray-500">Memuat riwayat...</p>
                ) : historyError ? (
                  <p className="text-sm text-red-700">{historyError}</p>
                ) : (
                  <ol className="space-y-2.5 border-l border-gray-200 pl-4">
                    {(history?.kode === kode ? history.items : []).map((h, i) => (
                      <li key={`${h.event}-${h.at}-${i}`} className="relative">
                        <span className="absolute -left-5 top-1.5 size-2 rounded-full bg-brand-700" />
                        <p className="text-sm text-gray-900">{EVENT_LABEL[h.event]}</p>
                        <p className="text-xs text-gray-500">{formatDateTimeWIB(h.at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    );
  }

  return (
    <AppShell wide>
      <PageHeader
        title="Detail Laporan"
        subtitle={kode.toUpperCase()}
        onBack={goBack}
      />
      {body}
    </AppShell>
  );
}
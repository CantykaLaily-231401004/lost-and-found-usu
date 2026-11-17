import { callRpc } from "./rpc";
import { signedUrls } from "./lostReports";
import {
  catalogRowToReport,
  reportStatusToDb,
  type CatalogReport,
  type CatalogRow,
} from "./mappers";
import type { ReportKind, ReportStatus } from "../shared/store/lofiStore";

/** Jumlah laporan per halaman (SRS FR-14). Sama dengan c_per_halaman di rpc_search_reports. */
export const PAGE_SIZE = 20;

/** Tab jenis laporan di halaman Cari Barang. */
export type SearchKind = "semua" | ReportKind;

/** "" = belum dipilih (bawaan: Aktif + Tersedia), "semua" = semua status. */
export type SearchStatus = "" | "semua" | ReportStatus;

export type SearchParams = {
  kind: SearchKind;
  keyword: string;
  category: string;
  areaId: string;
  status: SearchStatus;
  page: number;
};

export type SearchResult = {
  items: CatalogReport[];
  total: number;
  page: number;
  totalPages: number;
  /** Angka di tab, ikut filter yang aktif (kecuali jenis). */
  counts: { semua: number; found: number; lost: number };
  /** Angka di banner, total katalog tanpa filter. */
  stats: { available: number; newFound: number; activeLost: number };
};

export type TimelineEvent =
  | "dilaporkan"
  | "diperbarui"
  | "dicadangkan"
  | "tersedia_kembali"
  | "diserahkan"
  | "ditutup";

export type TimelineItem = { event: TimelineEvent; at: string };

type SearchData = {
  total: number;
  halaman: number;
  per_halaman: number;
  total_halaman: number;
  jumlah_jenis: { semua: number; kehilangan: number; penemuan: number };
  statistik: { barang_tersedia: number; temuan_baru: number; laporan_aktif: number };
  items: CatalogRow[];
};

type TimelineData = {
  kode: string;
  jenis: ReportKind;
  items: { peristiwa: TimelineEvent; waktu: string }[] | null;
};

const KIND_TO_DB: Record<SearchKind, string> = {
  semua: "semua",
  lost: "kehilangan",
  found: "penemuan",
};

function statusToDb(status: SearchStatus): string | null {
  if (status === "") return null;
  if (status === "semua") return "semua";
  return reportStatusToDb(status);
}

/** Ubah baris katalog menjadi Report, foto memakai signed URL (bucket privat). */
async function rowsToReports(rows: CatalogRow[]): Promise<CatalogReport[]> {
  const urls = await signedUrls(rows.flatMap((r) => r.foto.map((p) => p.storage_path)));
  return rows.map((r) => catalogRowToReport(r, (path) => urls.get(path) ?? ""));
}

/** Cari laporan di katalog (kehilangan + temuan) sesuai filter, 20 per halaman. */
export async function searchReports(p: SearchParams): Promise<SearchResult> {
  const data = await callRpc<SearchData>("rpc_search_reports", {
    p_jenis: KIND_TO_DB[p.kind],
    p_kata_kunci: p.keyword.trim() || null,
    p_kategori: p.category || null,
    p_area_id: p.areaId || null,
    p_status: statusToDb(p.status),
    p_halaman: p.page,
  });
  return {
    items: await rowsToReports(data.items),
    total: data.total,
    page: data.halaman,
    totalPages: data.total_halaman,
    counts: {
      semua: data.jumlah_jenis.semua,
      found: data.jumlah_jenis.penemuan,
      lost: data.jumlah_jenis.kehilangan,
    },
    stats: {
      available: data.statistik.barang_tersedia,
      newFound: data.statistik.temuan_baru,
      activeLost: data.statistik.laporan_aktif,
    },
  };
}

/** Satu laporan untuk halaman detail, status terbaru, semua status. null = tidak ditemukan. */
export async function getCatalogReport(kode: string): Promise<CatalogReport | null> {
  const data = await callRpc<SearchData>("rpc_search_reports", { p_kode: kode });
  const [report] = await rowsToReports(data.items);
  return report ?? null;
}

/** Riwayat laporan (nama kejadian + waktu), terlama dulu. Tanpa pelaku dan alasan. */
export async function getReportTimeline(kode: string): Promise<TimelineItem[]> {
  const data = await callRpc<TimelineData>("rpc_get_report_timeline", { p_kode: kode });
  return (data.items ?? []).map((i) => ({ event: i.peristiwa, at: i.waktu }));
}
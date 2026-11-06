import { MAX_PHOTOS, type Photo } from "../components/PhotoUpload";
import { OTHER_CATEGORY } from "./reportOptions";

export type ReportValues = {
  category: string;
  /** Diisi hanya jika category = Lainnya. */
  categoryOther: string;
  description: string;
  color: string;
  brand: string;
  location: string;
  area: string;
  date: string;
  time: string;
  photos: Photo[];
};

export type ReportErrors = Partial<Record<keyof ReportValues, string>>;

export const emptyReport: ReportValues = {
  category: "",
  categoryOther: "",
  description: "",
  color: "",
  brand: "",
  location: "",
  area: "",
  date: "",
  time: "",
  photos: [],
};

export const MIN_DESCRIPTION = 20;

/** Tanggal lokal hari ini, format YYYY-MM-DD, untuk atribut max input date. */
export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function validateReport(
  v: ReportValues,
  kind: "lost" | "found",
): ReportErrors {
  const e: ReportErrors = {};
  const lost = kind === "lost";

  if (!v.category) e.category = "Pilih kategori barang.";
  else if (v.category === OTHER_CATEGORY && v.categoryOther.trim().length < 3)
    e.categoryOther = "Sebutkan jenis barangnya (minimal 3 karakter).";
  if (!v.description.trim())
    e.description = lost
      ? "Deskripsi barang wajib diisi."
      : "Deskripsi publik wajib diisi.";
  else if (v.description.trim().length < MIN_DESCRIPTION)
    e.description = `Deskripsi minimal ${MIN_DESCRIPTION} karakter.`;
  if (!v.location.trim())
    e.location = lost
      ? "Lokasi kejadian wajib diisi."
      : "Lokasi penemuan wajib diisi.";
  if (!v.area) e.area = "Pilih fakultas atau area.";

  if (!v.date) e.date = "Tanggal wajib diisi.";
  else {
    const when = new Date(`${v.date}T${v.time || "00:00"}`);
    if (Number.isNaN(when.getTime())) e.date = "Tanggal tidak valid.";
    else if (!v.time && v.date > todayISO())
      e.date = "Tanggal tidak boleh di masa depan.";
    else if (v.time && when.getTime() > Date.now())
      e.time = "Waktu tidak boleh melewati saat ini.";
  }

  if (v.photos.length > MAX_PHOTOS) e.photos = `Maksimal ${MAX_PHOTOS} foto.`;
  return e;
}

/** Fokus ke kolom pertama yang bermasalah di dalam form. */
export function focusFirstError(root: HTMLElement | null) {
  const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}

/**
 * Pengganti sementara pemanggilan Supabase.
 * Buka halaman dengan ?demo=error untuk melihat tampilan gagal kirim.
 */
export async function submitReportDummy(
  kind: "lost" | "found",
): Promise<{ id: string }> {
  await new Promise((r) => setTimeout(r, 1400));
  if (new URLSearchParams(window.location.search).get("demo") === "error")
    throw new Error("Layanan tidak merespons.");
  const n = Math.floor(Math.random() * 9000) + 1000;
  return { id: `${kind === "lost" ? "KEH" : "TEM"}-${n}` };
}

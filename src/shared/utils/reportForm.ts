import { MAX_PHOTOS, type Photo } from "../components/PhotoUpload";
import { OTHER_CATEGORY } from "./reportOptions";
import type { Report, ReportInput } from "../store/lofiStore";

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

/** Batas isian, sama dengan database (lost_report_input_error) dan SRS yang disepakati. */
export const MIN_DESCRIPTION = 20;
export const MAX_DESCRIPTION = 2000;
export const MAX_CATEGORY_OTHER = 50;
export const MAX_COLOR = 30;
export const MAX_BRAND = 50;
export const MAX_LOCATION = 150;

const wibFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function nowWib() {
  const p = Object.fromEntries(
    wibFormat.formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Tanggal hari ini (WIB), format YYYY-MM-DD, untuk atribut max input date. */
export function todayISO() {
  return nowWib().date;
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
  else if (
    v.category === OTHER_CATEGORY &&
    v.categoryOther.trim().length > MAX_CATEGORY_OTHER
  )
    e.categoryOther = `Jenis barang maksimal ${MAX_CATEGORY_OTHER} karakter.`;
  if (!v.description.trim())
    e.description = lost
      ? "Deskripsi barang wajib diisi."
      : "Deskripsi publik wajib diisi.";
  else if (v.description.trim().length < MIN_DESCRIPTION)
    e.description = `Deskripsi minimal ${MIN_DESCRIPTION} karakter.`;
  else if (v.description.trim().length > MAX_DESCRIPTION)
    e.description = `Deskripsi maksimal ${MAX_DESCRIPTION} karakter.`;
  if (v.color.trim().length > MAX_COLOR)
    e.color = `Warna maksimal ${MAX_COLOR} karakter.`;
  if (v.brand.trim().length > MAX_BRAND)
    e.brand = `Merek maksimal ${MAX_BRAND} karakter.`;
  if (!v.location.trim())
    e.location = lost
      ? "Lokasi kejadian wajib diisi."
      : "Lokasi penemuan wajib diisi.";
  else if (v.location.trim().length > MAX_LOCATION)
    e.location = `Lokasi maksimal ${MAX_LOCATION} karakter.`;
  if (!v.area) e.area = "Pilih area kampus.";

  // Tanggal dan jam dibandingkan dalam WIB (SRS 3.2 aturan 3).
  const now = nowWib();
  if (!v.date) e.date = "Tanggal wajib diisi.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = "Tanggal tidak valid.";
  else if (v.date > now.date) e.date = "Tanggal tidak boleh di masa depan.";
  else if (v.time && v.date === now.date && v.time > now.time)
    e.time = "Waktu tidak boleh melewati saat ini.";

  if (v.photos.length > MAX_PHOTOS) e.photos = `Maksimal ${MAX_PHOTOS} foto.`;
  return e;
}

/** Fokus ke kolom pertama yang bermasalah di dalam form. */
export function focusFirstError(root: HTMLElement | null) {
  const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]:not([hidden] *)');
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

/** Isi form dari laporan yang sudah ada (mode ubah). */
export function reportToValues(r: Report): ReportValues {
  return {
    category: r.category,
    categoryOther: r.categoryOther,
    description: r.description,
    color: r.color,
    brand: r.brand,
    location: r.location,
    area: r.areaId ?? r.area,
    date: r.date,
    time: r.time,
    photos: r.photos.map((url, i) => ({ file: null, url, id: r.photoIds?.[i] })),
  };
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

/** Ubah isi form menjadi data laporan. Foto baru dibaca jadi data URL. */
export async function valuesToInput(
  kind: "lost" | "found",
  v: ReportValues,
  secrets: string[] = [],
): Promise<ReportInput> {
  const photos = await Promise.all(
    v.photos.map((p) => (p.file ? readAsDataUrl(p.file) : p.url)),
  );
  return {
    kind,
    category: v.category,
    categoryOther: v.categoryOther.trim(),
    description: v.description.trim(),
    color: v.color.trim(),
    brand: v.brand.trim(),
    location: v.location.trim(),
    area: v.area,
    date: v.date,
    time: v.time,
    secrets: secrets.map((x) => x.trim()).filter(Boolean),
    photos,
  };
}

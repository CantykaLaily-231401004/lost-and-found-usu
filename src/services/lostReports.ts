import { supabase } from "./supabase";
import { callRpc, ServiceError, toServiceError } from "./rpc";
import { lostRowToReport, type LostReportRow } from "./mappers";
import type { Report } from "../shared/store/lofiStore";

export const BUCKET = "report-photos";
const SIGNED_URL_SECONDS = 60 * 60;

const SELECT =
  "lost_id, kode, user_id, area_id, kategori, kategori_lainnya, deskripsi, warna, merek, " +
  "lokasi_kehilangan, tanggal_kehilangan, jam_kehilangan, status, created_at, " +
  "areas(nama_area), photos(photo_id, storage_path, created_at)";

/** Isian form laporan kehilangan. `areaId` = area_id, `date` = YYYY-MM-DD, `time` = HH:MM atau "". */
export type LostReportInput = {
  category: string;
  categoryOther: string;
  description: string;
  color: string;
  brand: string;
  location: string;
  areaId: string;
  date: string;
  time: string;
};

export type LostHistoryItem = {
  lost_id: string;
  kode: string;
  aksi: "dibuat" | "diubah" | "ditutup";
  waktu: string;
  alasan: string | null;
};

function inputArgs(v: LostReportInput) {
  return {
    p_area_id: v.areaId,
    p_kategori: v.category,
    p_kategori_lainnya: v.categoryOther || null,
    p_deskripsi: v.description,
    p_lokasi_kehilangan: v.location,
    p_tanggal_kehilangan: v.date,
    p_jam_kehilangan: v.time || null,
    p_warna: v.color || null,
    p_merek: v.brand || null,
  };
}

/* ---------- foto ---------- */

/** Unggah satu foto ke `{folder}/{acak}.jpg|png`, kembalikan path Storage-nya. */
export async function uploadLostPhoto(folder: string, file: File): Promise<string> {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new ServiceError("NETWORK", "Foto gagal diunggah.", "photos");
  return path;
}

export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) return new Map(); // foto gagal dimuat tidak menggagalkan daftar laporan
  const urls = new Map<string, string>();
  for (const d of data) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return urls;
}

async function rowsToReports(rows: LostReportRow[]): Promise<Report[]> {
  const urls = await signedUrls(rows.flatMap((r) => (r.photos ?? []).map((p) => p.storage_path)));
  return rows.map((r) => lostRowToReport(r, (path) => urls.get(path) ?? ""));
}

/* ---------- baca ---------- */

/** Semua laporan kehilangan milik pengguna, terbaru dulu, lengkap dengan alasan penutupan. */
export async function listMyLostReports(userId: string): Promise<Report[]> {
  const [res, history] = await Promise.all([
    supabase
      .from("lost_reports")
      .select(SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("lost_id", { ascending: false }),
    getMyLostHistory(),
  ]);
  if (res.error) throw toServiceError(res.error);

  const reports = await rowsToReports(res.data as unknown as LostReportRow[]);
  // Riwayat sudah urut terbaru dulu: kejadian "ditutup" pertama = alasan penutupan terakhir.
  const reasons = new Map<string, string>();
  for (const h of history)
    if (h.aksi === "ditutup" && h.alasan && !reasons.has(h.lost_id))
      reasons.set(h.lost_id, h.alasan);
  return reports.map((r) => ({ ...r, closeReason: reasons.get(r.id) }));
}

/** Satu laporan aktif milik pengguna, untuk form ubah. null bila tidak ada / bukan miliknya / sudah ditutup. */
export async function getMyActiveLostReport(id: string, userId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from("lost_reports")
    .select(SELECT)
    .eq("lost_id", id)
    .eq("user_id", userId)
    .eq("status", "aktif")
    .maybeSingle();
  if (error) throw toServiceError(error);
  if (!data) return null;
  const [report] = await rowsToReports([data as unknown as LostReportRow]);
  return report;
}

/** Riwayat (dibuat, diubah, ditutup) semua laporan kehilangan milik pengguna. */
export function getMyLostHistory(): Promise<LostHistoryItem[]> {
  return callRpc<LostHistoryItem[]>("rpc_get_my_lost_report_history");
}

/* ---------- tulis (semua lewat RPC) ---------- */

/**
 * Buat laporan. `requestId` dibuat sekali per form; kiriman ulang dengan nilai sama
 * mengembalikan laporan yang sudah tersimpan (duplikat: true), bukan laporan baru.
 */
export function createLostReport(input: LostReportInput, requestId: string, photoPaths: string[]) {
  return callRpc<{ lost_id: string; kode: string; duplikat: boolean }>("rpc_create_lost_report", {
    p_client_request_id: requestId,
    ...inputArgs(input),
    p_photo_paths: photoPaths,
  });
}

/** Ubah laporan aktif milik sendiri. Berkas foto yang dilepas dihapus dari Storage setelah berhasil. */
export async function updateLostReport(
  id: string,
  input: LostReportInput,
  newPhotoPaths: string[],
  removePhotoIds: string[],
) {
  const res = await callRpc<{ kode: string; berubah: boolean; foto_dihapus: string[] }>(
    "rpc_update_lost_report",
    { p_lost_id: id, ...inputArgs(input), p_foto_baru: newPhotoPaths, p_foto_hapus: removePhotoIds },
  );
  if (res.foto_dihapus.length) await supabase.storage.from(BUCKET).remove(res.foto_dihapus);
  return res;
}

/** Tutup laporan aktif milik sendiri. Alasan 10–300 karakter. */
export function closeLostReport(id: string, reason: string) {
  return callRpc<{ lost_id: string; status: "ditutup" }>("rpc_close_lost_report", {
    p_lost_id: id,
    p_alasan: reason,
  });
}
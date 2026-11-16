import { supabase } from "./supabase";
import { callRpc, toServiceError } from "./rpc";
import { foundRowToReport, type FoundReportRow } from "./mappers";
import { BUCKET, signedUrls, type LostReportInput } from "./lostReports";
import type { Report } from "../shared/store/lofiStore";

export { uploadLostPhoto as uploadFoundPhoto } from "./lostReports";

const SELECT =
  "found_id, kode, user_id, area_id, kategori, kategori_lainnya, deskripsi, warna, merek, " +
  "lokasi_temuan, tanggal_temuan, jam_temuan, status, created_at, " +
  "areas(nama_area), photos(photo_id, storage_path, created_at), data_rahasia(ciri_rahasia)";

export type FoundReportInput = LostReportInput;

export type FoundHistoryItem = {
  found_id: string;
  kode: string;
  aksi: "dibuat" | "diubah" | "ditutup";
  waktu: string;
  alasan: string | null;
};

function inputArgs(v: FoundReportInput, secrets: string[]) {
  return {
    p_area_id: v.areaId,
    p_kategori: v.category,
    p_kategori_lainnya: v.categoryOther || null,
    p_deskripsi: v.description,
    p_lokasi_temuan: v.location,
    p_tanggal_temuan: v.date,
    p_jam_temuan: v.time || null,
    p_warna: v.color || null,
    p_merek: v.brand || null,
    p_ciri_rahasia: secrets.map((s) => s.trim()).filter(Boolean),
  };
}

async function rowsToReports(rows: FoundReportRow[]): Promise<Report[]> {
  const urls = await signedUrls(rows.flatMap((r) => (r.photos ?? []).map((p) => p.storage_path)));
  return rows.map((r) => foundRowToReport(r, (path) => urls.get(path) ?? ""));
}

export async function listMyFoundReports(userId: string): Promise<Report[]> {
  const [res, history] = await Promise.all([
    supabase
      .from("found_reports")
      .select(SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("found_id", { ascending: false }),
    getMyFoundHistory(),
  ]);
  if (res.error) throw toServiceError(res.error);

  const reports = await rowsToReports(res.data as unknown as FoundReportRow[]);
  const reasons = new Map<string, string>();
  for (const h of history)
    if (h.aksi === "ditutup" && h.alasan && !reasons.has(h.found_id))
      reasons.set(h.found_id, h.alasan);
  return reports.map((r) => ({ ...r, closeReason: reasons.get(r.id) }));
}

export async function getMyEditableFoundReport(id: string, userId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from("found_reports")
    .select(SELECT)
    .eq("found_id", id)
    .eq("user_id", userId)
    .eq("status", "tersedia")
    .maybeSingle();
  if (error) throw toServiceError(error);
  if (!data) return null;
  const [report] = await rowsToReports([data as unknown as FoundReportRow]);
  return report;
}

export function getMyFoundHistory(): Promise<FoundHistoryItem[]> {
  return callRpc<FoundHistoryItem[]>("rpc_get_my_found_report_history");
}

export function createFoundReport(
  input: FoundReportInput,
  secrets: string[],
  requestId: string,
  photoPaths: string[],
) {
  return callRpc<{ found_id: string; kode: string; duplikat: boolean }>("rpc_create_found_report", {
    p_client_request_id: requestId,
    ...inputArgs(input, secrets),
    p_photo_paths: photoPaths,
  });
}

export async function updateFoundReport(
  id: string,
  input: FoundReportInput,
  secrets: string[],
  newPhotoPaths: string[],
  removePhotoIds: string[],
) {
  const res = await callRpc<{ kode: string; berubah: boolean; foto_dihapus: string[] }>(
    "rpc_update_found_report",
    {
      p_found_id: id,
      ...inputArgs(input, secrets),
      p_foto_baru: newPhotoPaths,
      p_foto_hapus: removePhotoIds,
    },
  );
  if (res.foto_dihapus.length) await supabase.storage.from(BUCKET).remove(res.foto_dihapus);
  return res;
}

export function closeFoundReport(id: string, reason: string) {
  return callRpc<{ found_id: string; status: "ditutup" }>("rpc_close_found_report", {
    p_found_id: id,
    p_alasan: reason,
  });
}
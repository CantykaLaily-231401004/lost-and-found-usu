import { supabase } from "./supabase";
import { toServiceError } from "./rpc";

export type Area = { id: string; name: string; jenis: "fakultas" | "umum" };

let cache: Promise<Area[]> | null = null;

/**
 * Daftar area kampus dari tabel `areas` (Area Umum Kampus di urutan pertama).
 * Diambil sekali lalu disimpan selama halaman terbuka; gagal = diambil ulang lain kali.
 */
export function fetchAreas(): Promise<Area[]> {
  cache ??= (async () => {
    const { data, error } = await supabase
      .from("areas")
      .select("area_id, nama_area, jenis_area")
      .order("jenis_area", { ascending: false })
      .order("nama_area");
    if (error) {
      cache = null;
      throw toServiceError(error);
    }
    return data.map((r) => ({
      id: r.area_id as string,
      name: r.nama_area as string,
      jenis: r.jenis_area as Area["jenis"],
    }));
  })();
  return cache;
}
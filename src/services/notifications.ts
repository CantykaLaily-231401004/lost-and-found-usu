import { supabase } from "./supabase";
import { toServiceError } from "./rpc";
import type { NotifType } from "../shared/store/lofiStore";

export type AppNotification = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

type Row = {
  notification_id: string;
  jenis: string;
  pesan: string;
  status_baca: boolean;
  created_at: string;
};

// Judul dan kelompok tab per jenis notifikasi dari database
const META: Record<string, { type: NotifType; title: string }> = {
  klaim_diajukan: { type: "Klaim", title: "Klaim berhasil diajukan" },
  klaim_baru: { type: "Klaim", title: "Klaim baru menunggu verifikasi" },
  klaim_disetujui: { type: "Klaim", title: "Klaim disetujui" },
  klaim_ditolak: { type: "Klaim", title: "Klaim ditolak" },
  klaim_dibatalkan: { type: "Klaim", title: "Klaim dibatalkan" },
  klaim_selesai: { type: "Klaim", title: "Klaim selesai" },
  jadwal_diajukan: { type: "Pengambilan", title: "Jadwal serah terima diajukan" },
  jadwal_dibuat: { type: "Pengambilan", title: "Jadwal serah terima ditetapkan" },
  jadwal_diubah: { type: "Pengambilan", title: "Jadwal serah terima diubah" },
  jadwal_dibatalkan: { type: "Pengambilan", title: "Jadwal serah terima dibatalkan" },
  konfirmasi_diperlukan: { type: "Pengambilan", title: "Konfirmasi diperlukan" },
  kode_pengambilan: { type: "Pengambilan", title: "Kode pengambilan barang" },
  serah_terima_selesai: { type: "Pengambilan", title: "Serah terima selesai" },
  status_temuan: { type: "Laporan", title: "Status laporan berubah" },
  peran_admin: { type: "Sistem", title: "Peran admin diperbarui" },
};

const FALLBACK = { type: "Sistem" as NotifType, title: "Notifikasi baru" };

function toNotification(r: Row): AppNotification {
  const meta = META[r.jenis] ?? FALLBACK;
  return {
    id: r.notification_id,
    type: meta.type,
    title: meta.title,
    body: r.pesan,
    read: r.status_baca,
    createdAt: r.created_at,
  };
}

export const NOTIF_CHANGED_EVENT = "notifications-changed";

/** Beri tahu bagian lain aplikasi (misalnya navbar) bahwa status baca berubah. */
function notifyChanged() {
  window.dispatchEvent(new Event(NOTIF_CHANGED_EVENT));
}

/** Jumlah notifikasi yang belum dibaca milik pengguna yang login (dibatasi RLS). */
export async function countMyUnread(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("notification_id", { count: "exact", head: true })
    .eq("status_baca", false);
  if (error) throw toServiceError(error);
  return count ?? 0;
}

/** Ambil notifikasi milik pengguna yang sedang login (dibatasi RLS). */
export async function listMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("notification_id, jenis, pesan, status_baca, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw toServiceError(error);
  return (data as Row[]).map(toNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ status_baca: true })
    .eq("notification_id", id);
  if (error) throw toServiceError(error);
  notifyChanged();
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ status_baca: true })
    .eq("status_baca", false);
  if (error) throw toServiceError(error);
  notifyChanged();
}

/**
 * Berlangganan notifikasi baru secara realtime.
 * Mengembalikan fungsi untuk berhenti berlangganan.
 * (Butuh tabel notifications aktif di Database > Replication / publication supabase_realtime.)
 */
export function subscribeMyNotifications(
  userId: string,
  onInsert: (n: AppNotification) => void,
): () => void {
  const channel = supabase
    .channel(`notif-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(toNotification(payload.new as Row)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

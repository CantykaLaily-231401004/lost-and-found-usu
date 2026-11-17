import { OTHER_CATEGORY } from "../shared/utils/reportOptions";
import type {
  Claim,
  ClaimStatus,
  Notif,
  NotifType,
  Report,
  ReportKind,
  ReportStatus,
  ScheduleStatus,
} from "../shared/store/lofiStore";

export type DbReportStatus =
  | "aktif"
  | "tersedia"
  | "dicadangkan"
  | "diserahkan"
  | "ditutup";
export type DbClaimStatus =
  | "menunggu"
  | "disetujui"
  | "ditolak"
  | "dibatalkan"
  | "selesai";
export type DbScheduleStatus = "terjadwal" | "dibatalkan" | "selesai";

function capitalize<T extends string>(s: string): T {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as T;
}

export const reportStatusFromDb = (s: DbReportStatus) =>
  capitalize<ReportStatus>(s);
export const reportStatusToDb = (s: ReportStatus) =>
  s.toLowerCase() as DbReportStatus;

export const claimStatusFromDb = (s: DbClaimStatus) =>
  capitalize<ClaimStatus>(s);
export const claimStatusToDb = (s: ClaimStatus) =>
  s.toLowerCase() as DbClaimStatus;

export const scheduleStatusFromDb = (s: DbScheduleStatus) =>
  capitalize<ScheduleStatus>(s);
export const scheduleStatusToDb = (s: ScheduleStatus) =>
  s.toLowerCase() as DbScheduleStatus;

const OTHER_PREFIX = `${OTHER_CATEGORY}: `;

export function categoryToDb(category: string, categoryOther: string): string {
  const other = categoryOther.trim();
  return category === OTHER_CATEGORY && other
    ? `${OTHER_PREFIX}${other}`
    : category;
}

export function categoryFromDb(kategori: string): {
  category: string;
  categoryOther: string;
} {
  return kategori.startsWith(OTHER_PREFIX)
    ? {
        category: OTHER_CATEGORY,
        categoryOther: kategori.slice(OTHER_PREFIX.length),
      }
    : { category: kategori, categoryOther: "" };
}

export function wibToTimestamp(date: string, time: string): string {
  return `${date}T${time || "00:00"}:00+07:00`;
}

const wibParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function timestampToWib(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(
    wibParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}


type AreaJoin = { areas?: { nama_area: string } | null };

export type LostReportRow = AreaJoin & {
  lost_id: string;
  kode: string;
  user_id: string;
  area_id: string;
  kategori: string;
  kategori_lainnya: string | null;
  deskripsi: string;
  warna: string | null;
  merek: string | null;
  lokasi_kehilangan: string;
  tanggal_kehilangan: string;
  jam_kehilangan: string | null;
  status: DbReportStatus;
  created_at: string;
  photos?: { photo_id: string; storage_path: string }[];
};

export type FoundReportRow = AreaJoin & {
  found_id: string;
  kode: string;
  user_id: string;
  area_id: string;
  kategori: string;
  kategori_lainnya: string | null;
  deskripsi: string;
  warna: string | null;
  merek: string | null;
  lokasi_temuan: string;
  tanggal_temuan: string;
  jam_temuan: string | null;
  status: DbReportStatus;
  created_at: string;
  photos?: { photo_id: string; storage_path: string }[];
  data_rahasia?: { ciri_rahasia: string[] } | { ciri_rahasia: string[] }[] | null;
};

export function lostRowToReport(
  row: LostReportRow,
  photoUrl: (path: string) => string = () => "",
): Report {
  const photos = row.photos ?? [];
  return {
    id: row.lost_id,
    kode: row.kode,
    kind: "lost",
    ownerId: row.user_id,
    category: row.kategori,
    categoryOther: row.kategori_lainnya ?? "",
    description: row.deskripsi,
    color: row.warna ?? "",
    brand: row.merek ?? "",
    location: row.lokasi_kehilangan,
    area: row.areas?.nama_area ?? "",
    areaId: row.area_id,
    date: row.tanggal_kehilangan,
    time: row.jam_kehilangan?.slice(0, 5) ?? "",
    secrets: [],
    status: reportStatusFromDb(row.status),
    createdAt: row.created_at,
    photos: photos.map((p) => photoUrl(p.storage_path)),
    photoIds: photos.map((p) => p.photo_id),
  };
}

export function foundRowToReport(
  row: FoundReportRow,
  photoUrl: (path: string) => string = () => "",
): Report {
  const photos = row.photos ?? [];
  const rahasia = Array.isArray(row.data_rahasia) ? row.data_rahasia[0] : row.data_rahasia;
  return {
    id: row.found_id,
    kode: row.kode,
    kind: "found",
    ownerId: row.user_id,
    category: row.kategori,
    categoryOther: row.kategori_lainnya ?? "",
    description: row.deskripsi,
    color: row.warna ?? "",
    brand: row.merek ?? "",
    location: row.lokasi_temuan,
    area: row.areas?.nama_area ?? "",
    areaId: row.area_id,
    date: row.tanggal_temuan,
    time: row.jam_temuan?.slice(0, 5) ?? "",
    secrets: rahasia?.ciri_rahasia ?? [],
    status: reportStatusFromDb(row.status),
    createdAt: row.created_at,
    photos: photos.map((p) => photoUrl(p.storage_path)),
    photoIds: photos.map((p) => p.photo_id),
  };
}

export type CatalogRow = {
  id: string;
  kode: string;
  jenis: ReportKind;
  kategori: string;
  kategori_lainnya: string | null;
  deskripsi: string;
  warna: string | null;
  merek: string | null;
  area_id: string;
  nama_area: string | null;
  lokasi: string;
  tanggal: string;
  jam: string | null;
  status: DbReportStatus;
  created_at: string;
  milik_saya: boolean;
  foto: { photo_id: string; storage_path: string }[];
};

export type CatalogReport = Report & { mine: boolean };

export function catalogRowToReport(
  row: CatalogRow,
  photoUrl: (path: string) => string = () => "",
): CatalogReport {
  return {
    id: row.id,
    kode: row.kode,
    kind: row.jenis,
    ownerId: "", 
    category: row.kategori,
    categoryOther: row.kategori_lainnya ?? "",
    description: row.deskripsi,
    color: row.warna ?? "",
    brand: row.merek ?? "",
    location: row.lokasi,
    area: row.nama_area ?? "",
    areaId: row.area_id,
    date: row.tanggal,
    time: row.jam?.slice(0, 5) ?? "",
    secrets: [],
    status: reportStatusFromDb(row.status),
    createdAt: row.created_at,
    photos: row.foto.map((p) => photoUrl(p.storage_path)),
    photoIds: row.foto.map((p) => p.photo_id),
    mine: row.milik_saya,
  };
}

export type ClaimRow = {
  claim_id: string;
  user_id: string;
  found_id: string;
  ciri_kepemilikan: string;
  status: DbClaimStatus;
  alasan: string | null;
  ciri_cocok: number[] | null;
  decision_at: string | null;
  created_at: string;
};

export function claimRowToClaim(row: ClaimRow): Claim {
  return {
    id: row.claim_id,
    ownerId: row.user_id,
    reportId: row.found_id,
    evidence: row.ciri_kepemilikan,
    status: claimStatusFromDb(row.status),
    createdAt: row.created_at,
    decisionReason: row.alasan ?? undefined,
    decidedAt: row.decision_at ?? undefined,
    matchedSecrets: row.ciri_cocok ?? undefined,
  };
}

export type MyClaimRow = {
  claim_id: string;
  found_id: string;
  ciri_kepemilikan: string;
  status: DbClaimStatus;
  alasan: string | null;
  tanggal_pengajuan: string;
  decision_at: string | null;
  found_reports: {
    kode: string;
    kategori: string;
    kategori_lainnya: string | null;
    deskripsi: string;
    lokasi_temuan: string;
  } | null;
};

export type MyClaim = {
  id: string;
  foundId: string;
  evidence: string;
  status: ClaimStatus;
  reason?: string;
  createdAt: string;
  decidedAt?: string;
  item: {
    kode: string;
    category: string;
    categoryOther: string;
    description: string;
    location: string;
  } | null;
};

export function myClaimRowToClaim(row: MyClaimRow): MyClaim {
  const f = row.found_reports;
  return {
    id: row.claim_id,
    foundId: row.found_id,
    evidence: row.ciri_kepemilikan,
    status: claimStatusFromDb(row.status),
    reason: row.alasan ?? undefined,
    createdAt: row.tanggal_pengajuan,
    decidedAt: row.decision_at ?? undefined,
    item: f
      ? {
          kode: f.kode,
          category: f.kategori,
          categoryOther: f.kategori_lainnya ?? "",
          description: f.deskripsi,
          location: f.lokasi_temuan,
        }
      : null,
  };
}

export type NotificationRow = {
  notification_id: string;
  user_id: string;
  jenis: string;
  pesan: string;
  status_baca: boolean;
  created_at: string;
};

/** Judul per `jenis` yang dikirim RPC lewat public.internal_notify. */
const NOTIF_TITLES: Record<string, string> = {
  klaim_baru: "Klaim Baru",
  klaim_disetujui: "Klaim Disetujui",
  klaim_ditolak: "Klaim Ditolak",
  klaim_dibatalkan: "Klaim Dibatalkan",
  status_temuan: "Status Laporan Temuan",
  jadwal_dibuat: "Jadwal Serah Terima",
  jadwal_diubah: "Jadwal Serah Terima Diubah",
  jadwal_dibatalkan: "Jadwal Serah Terima Dibatalkan",
  serah_terima_selesai: "Serah Terima Selesai",
  jadwal_diajukan: "Pengajuan Pengambilan Barang",
  konfirmasi_diperlukan: "Konfirmasi Diperlukan",
};

function notifType(jenis: string): NotifType {
  if (jenis.startsWith("klaim_")) return "Klaim";
  if (
    jenis.startsWith("jadwal_") ||
    jenis === "serah_terima_selesai" ||
    jenis === "konfirmasi_diperlukan"
  )
    return "Jadwal";
  if (jenis === "status_temuan" || jenis.startsWith("laporan_"))
    return "Laporan";
  return "Sistem";
}

export function notificationRowToNotif(row: NotificationRow): Notif {
  return {
    id: row.notification_id,
    ownerId: row.user_id,
    type: notifType(row.jenis),
    title: NOTIF_TITLES[row.jenis] ?? "Pemberitahuan",
    body: row.pesan,
    createdAt: row.created_at,
    read: row.status_baca,
  };
}

export type DbPickupStatus = "diajukan" | "terjadwal" | "dibatalkan" | "selesai";
export type PickupStatus =
  | "Menunggu Persetujuan"
  | "Terjadwal"
  | "Dibatalkan"
  | "Selesai";

const PICKUP_STATUS: Record<DbPickupStatus, PickupStatus> = {
  diajukan: "Menunggu Persetujuan",
  terjadwal: "Terjadwal",
  dibatalkan: "Dibatalkan",
  selesai: "Selesai",
};

export type MyScheduleRow = {
  schedule_id: string;
  claim_id: string;
  status: DbPickupStatus;
  waktu: string;
  lokasi: string | null;
  catatan: string | null;
  catatan_pemohon: string | null;
  alasan_batal: string | null;
  penanggung_jawab: string | null;
  nama_area: string;
  konfirmasi_pemilik_at: string | null;
  konfirmasi_penyerah_at: string | null;
  completed_at: string | null;
  created_at: string;
  kode: string;
  kategori: string;
  kategori_lainnya: string | null;
};

export type PendingPickupRow = {
  claim_id: string;
  kode: string;
  kategori: string;
  kategori_lainnya: string | null;
  nama_area: string;
  decision_at: string | null;
};

export type MySchedulesRaw = {
  jadwal: MyScheduleRow[];
  perlu_jadwal: PendingPickupRow[];
  klaim_menunggu: number;
};

export type MySchedule = {
  id: string;
  claimId: string;
  status: PickupStatus;
  at: string;
  place: string;
  note: string;
  requestNote: string;
  cancelReason: string;
  officer: string;
  area: string;
  ownerConfirmedAt?: string;
  officerConfirmedAt?: string;
  completedAt?: string;
  kode: string;
  category: string;
  categoryOther: string;
};

export type PendingPickup = {
  claimId: string;
  kode: string;
  category: string;
  categoryOther: string;
  area: string;
};

export type MySchedulesData = {
  schedules: MySchedule[];
  pending: PendingPickup[];
  waitingClaims: number;
};

export function mySchedulesFromRpc(raw: MySchedulesRaw): MySchedulesData {
  return {
    schedules: raw.jadwal.map((r) => ({
      id: r.schedule_id,
      claimId: r.claim_id,
      status: PICKUP_STATUS[r.status],
      at: r.waktu,
      place: r.lokasi ?? "",
      note: r.catatan ?? "",
      requestNote: r.catatan_pemohon ?? "",
      cancelReason: r.alasan_batal ?? "",
      officer: r.penanggung_jawab ?? "",
      area: r.nama_area,
      ownerConfirmedAt: r.konfirmasi_pemilik_at ?? undefined,
      officerConfirmedAt: r.konfirmasi_penyerah_at ?? undefined,
      completedAt: r.completed_at ?? undefined,
      kode: r.kode,
      category: r.kategori,
      categoryOther: r.kategori_lainnya ?? "",
    })),
    pending: raw.perlu_jadwal.map((r) => ({
      claimId: r.claim_id,
      kode: r.kode,
      category: r.kategori,
      categoryOther: r.kategori_lainnya ?? "",
      area: r.nama_area,
    })),
    waitingClaims: Number(raw.klaim_menunggu) || 0,
  };
}
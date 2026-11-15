import { OTHER_CATEGORY } from "../shared/utils/reportOptions";
import type {
  Claim,
  ClaimStatus,
  Notif,
  NotifType,
  Report,
  ReportStatus,
  ScheduleStatus,
} from "../shared/store/lofiStore";

/* ---------- status: huruf kecil di database, huruf kapital di halaman ---------- */

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

/* ---------- kategori: 2 field di halaman, 1 kolom `kategori` di database ---------- */

const OTHER_PREFIX = `${OTHER_CATEGORY}: `;

/** { category: "Lainnya", categoryOther: "Tumbler" } -> "Lainnya: Tumbler" */
export function categoryToDb(category: string, categoryOther: string): string {
  const other = categoryOther.trim();
  return category === OTHER_CATEGORY && other
    ? `${OTHER_PREFIX}${other}`
    : category;
}

/** "Lainnya: Tumbler" -> { category: "Lainnya", categoryOther: "Tumbler" } */
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

/* ---------- tanggal: date + time (WIB) di halaman, timestamptz di database ---------- */

/** "2026-11-15" + "17:30" -> "2026-11-15T17:30:00+07:00". Jam kosong dianggap 00:00. */
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

/** "2026-11-15T10:30:00+00:00" -> { date: "2026-11-15", time: "17:30" } (WIB). */
export function timestampToWib(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(
    wibParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/* ---------- baris tabel -> tipe halaman ---------- */

type AreaJoin = { areas?: { nama_area: string } | null };

type ReportRowBase = AreaJoin & {
  user_id: string;
  area_id: string;
  kategori: string;
  deskripsi: string;
  warna: string | null;
  merek: string | null;
  status: DbReportStatus;
  created_at: string;
};

export type LostReportRow = ReportRowBase & {
  lost_id: string;
  lokasi_kehilangan: string;
  tanggal_kehilangan: string;
};

export type FoundReportRow = ReportRowBase & {
  found_id: string;
  lokasi_temuan: string;
  tanggal_temuan: string;
};

function reportBase(row: ReportRowBase, when: string) {
  return {
    ownerId: row.user_id,
    ...categoryFromDb(row.kategori),
    description: row.deskripsi,
    color: row.warna ?? "",
    brand: row.merek ?? "",
    area: row.areas?.nama_area ?? "",
    ...timestampToWib(when),
    status: reportStatusFromDb(row.status),
    createdAt: row.created_at,
    secrets: [] as string[],
    photos: [] as string[],
  };
}

/** Baris lost_reports (boleh dengan join `areas(nama_area)`) -> Report. */
export function lostRowToReport(row: LostReportRow): Report {
  return {
    ...reportBase(row, row.tanggal_kehilangan),
    id: row.lost_id,
    kind: "lost",
    location: row.lokasi_kehilangan,
  };
}

/** Baris found_reports (boleh dengan join `areas(nama_area)`) -> Report. */
export function foundRowToReport(row: FoundReportRow): Report {
  return {
    ...reportBase(row, row.tanggal_temuan),
    id: row.found_id,
    kind: "found",
    location: row.lokasi_temuan,
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
  klaim_disetujui: "Klaim Disetujui",
  klaim_ditolak: "Klaim Ditolak",
  klaim_dibatalkan: "Klaim Dibatalkan",
  status_temuan: "Status Laporan Temuan",
  jadwal_dibuat: "Jadwal Serah Terima",
  jadwal_diubah: "Jadwal Serah Terima Diubah",
  jadwal_dibatalkan: "Jadwal Serah Terima Dibatalkan",
  serah_terima_selesai: "Serah Terima Selesai",
};

function notifType(jenis: string): NotifType {
  if (jenis.startsWith("klaim_")) return "Klaim";
  if (jenis.startsWith("jadwal_") || jenis === "serah_terima_selesai")
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
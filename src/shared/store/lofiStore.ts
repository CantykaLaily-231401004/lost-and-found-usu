/**
 * Penyimpanan DUMMY di browser (localStorage) supaya form, Laporan Saya,
 * Cari Barang, Klaim Saya, Jadwal, Notifikasi, dan Akun saling terhubung
 * tanpa Supabase. Ganti isi fungsi di file ini dengan pemanggilan Supabase
 * saat backend siap; halaman-halaman lain tidak perlu diubah.
 */
import { useSyncExternalStore } from "react";
import { OTHER_CATEGORY } from "../utils/reportOptions";
import { shorten } from "../utils/format";

export type ReportKind = "lost" | "found";
export type ReportStatus =
  | "Aktif"
  | "Tersedia"
  | "Dicadangkan"
  | "Diserahkan"
  | "Ditutup";
export type ClaimStatus =
  | "Menunggu"
  | "Disetujui"
  | "Ditolak"
  | "Dibatalkan"
  | "Selesai";
export type ScheduleStatus = "Terjadwal" | "Dibatalkan" | "Selesai";
export type NotifType = "Klaim" | "Jadwal" | "Laporan" | "Sistem";

export type Report = {
  id: string;
  kind: ReportKind;
  ownerId: string;
  category: string;
  categoryOther: string;
  description: string;
  color: string;
  brand: string;
  location: string;
  area: string;
  date: string;
  time: string;
  /** Ciri rahasia, hanya untuk laporan temuan dan hanya terlihat pemilik. */
  secrets: string[];
  status: ReportStatus;
  createdAt: string;
  /** URL pratinjau, hanya berlaku selama tab terbuka. */
  photos: string[];
  closeReason?: string;
};

export type Claim = {
  id: string;
  ownerId: string;
  reportId: string;
  evidence: string;
  status: ClaimStatus;
  createdAt: string;
  decisionReason?: string;
  decidedAt?: string;
  matchedSecrets?: number[];
};

export type Schedule = {
  id: string;
  ownerId: string;
  claimId: string;
  title: string;
  at: string;
  place: string;
  note: string;
  officer: string;
  /** Kosong dianggap Terjadwal (data lama). */
  status?: ScheduleStatus;
  cancelReason?: string;
};

export type Notif = {
  id: string;
  ownerId: string;
  type: NotifType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type State = {
  reports: Report[];
  claims: Claim[];
  schedules: Schedule[];
  notifications: Notif[];
};

export type ReportInput = Pick<
  Report,
  | "kind"
  | "category"
  | "categoryOther"
  | "description"
  | "color"
  | "brand"
  | "location"
  | "area"
  | "date"
  | "time"
  | "secrets"
  | "photos"
>;

const KEY = "lofi-dummy-store-v2";

function empty(): State {
  return { reports: [], claims: [], schedules: [], notifications: [] };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* abaikan: pakai data awal */
  }
  return empty();
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    // URL foto tidak ikut disimpan karena hanya berlaku selama tab terbuka.
    const persisted: State = {
      ...next,
      reports: next.reports.map((r) => ({ ...r, photos: [] })),
    };
    localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {
    /* penyimpanan penuh atau diblokir: data tetap ada di memori */
  }
  listeners.forEach((l) => l());
}

function nextId(prefix: string, ids: string[]) {
  const max = ids.reduce((m, id) => {
    const n = Number(id.split("-")[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function makeNotif(
  ownerId: string,
  type: NotifType,
  title: string,
  body: string,
): Notif {
  return {
    id: crypto.randomUUID(),
    ownerId,
    type,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function categoryLabel(r: Pick<Report, "category" | "categoryOther">) {
  return r.category === OTHER_CATEGORY && r.categoryOther.trim()
    ? `${r.category}: ${r.categoryOther.trim()}`
    : r.category;
}

/* ---------- tindakan ---------- */

export function addReport(input: ReportInput, ownerId: string): Report {
  const prefix = input.kind === "lost" ? "KEH" : "TEM";
  const report: Report = {
    ...input,
    id: nextId(
      prefix,
      state.reports.filter((r) => r.kind === input.kind).map((r) => r.id),
    ),
    ownerId,
    status: input.kind === "lost" ? "Aktif" : "Tersedia",
    createdAt: new Date().toISOString(),
  };
  const lost = input.kind === "lost";
  commit({
    ...state,
    reports: [report, ...state.reports],
    notifications: [
      makeNotif(
        ownerId,
        "Laporan",
        lost ? "Laporan Kehilangan Aktif" : "Laporan Temuan Tersedia",
        lost
          ? `Laporan kehilangan "${shorten(input.description)}" (ID: ${report.id}) telah berhasil dibuat dan sedang aktif.`
          : `Laporan temuan "${shorten(input.description)}" (ID: ${report.id}) telah terbit di katalog tanpa ciri rahasia Anda.`,
      ),
      ...state.notifications,
    ],
  });
  return report;
}

export function updateReport(id: string, input: ReportInput) {
  const old = state.reports.find((r) => r.id === id);
  if (!old) return;
  commit({
    ...state,
    reports: state.reports.map((r) => (r.id === id ? { ...r, ...input } : r)),
    notifications: [
      makeNotif(
        old.ownerId,
        "Laporan",
        "Laporan Diperbarui",
        `Perubahan pada laporan ${id} telah disimpan.`,
      ),
      ...state.notifications,
    ],
  });
}

export function closeReport(id: string, reason: string) {
  const old = state.reports.find((r) => r.id === id);
  if (!old) return;
  commit({
    ...state,
    reports: state.reports.map((r) =>
      r.id === id ? { ...r, status: "Ditutup", closeReason: reason } : r,
    ),
    notifications: [
      makeNotif(
        old.ownerId,
        "Laporan",
        "Laporan Ditutup",
        `Laporan ${id} telah ditutup. Alasan: ${reason}`,
      ),
      ...state.notifications,
    ],
  });
}

export function addClaim(reportId: string, evidence: string, ownerId: string) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) return null;
  const claim: Claim = {
    id: nextId(
      "KLM",
      state.claims.map((c) => c.id),
    ),
    ownerId,
    reportId,
    evidence: evidence.trim(),
    status: "Menunggu",
    createdAt: new Date().toISOString(),
  };
  commit({
    ...state,
    claims: [claim, ...state.claims],
    notifications: [
      makeNotif(
        ownerId,
        "Klaim",
        "Pengajuan Klaim Diterima",
        `Pengajuan klaim Anda untuk "${shorten(report.description)}" (ID: ${claim.id}) telah diterima dan sedang menunggu verifikasi admin.`,
      ),
      ...state.notifications,
    ],
  });
  return claim;
}

export function cancelClaim(id: string) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim || claim.status !== "Menunggu") return;
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === id ? { ...c, status: "Dibatalkan" } : c,
    ),
    notifications: [
      makeNotif(
        claim.ownerId,
        "Klaim",
        "Klaim Dibatalkan",
        `Pengajuan klaim ${id} telah Anda batalkan.`,
      ),
      ...state.notifications,
    ],
  });
}

export function markRead(id: string) {
  commit({
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    ),
  });
}

export function markAllRead(ownerId: string) {
  commit({
    ...state,
    notifications: state.notifications.map((n) =>
      n.ownerId === ownerId ? { ...n, read: true } : n,
    ),
  });
}

/* ---------- pembacaan ---------- */

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLofiStore() {
  return useSyncExternalStore(subscribe, () => state);
}

/** Klaim aktif (menunggu atau disetujui) pada sebuah laporan temuan. */
export function hasActiveClaim(s: State, reportId: string) {
  return s.claims.some(
    (c) =>
      c.reportId === reportId &&
      (c.status === "Menunggu" || c.status === "Disetujui"),
  );
}

/** Status efektif jadwal; data lama tanpa status dianggap Terjadwal. */
export function scheduleStatus(sc: Schedule): ScheduleStatus {
  return sc.status ?? "Terjadwal";
}

/** Semua jadwal milik user, termasuk riwayat (Selesai/Dibatalkan) sesuai SRS DR-01. */
export function schedulesOf(s: State, ownerId: string) {
  return s.schedules.filter((sc) => sc.ownerId === ownerId);
}

/* ---------- tindakan admin (dummy) ---------- */

/** Setujui klaim: wajib menandai minimal satu ciri rahasia yang cocok. */
export function approveClaim(id: string, matched: number[]) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim || claim.status !== "Menunggu" || matched.length < 1) return false;
  const report = state.reports.find((r) => r.id === claim.reportId);
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "Disetujui",
            matchedSecrets: matched,
            decidedAt: new Date().toISOString(),
          }
        : c,
    ),
    reports: state.reports.map((r) =>
      r.id === claim.reportId ? { ...r, status: "Dicadangkan" } : r,
    ),
    notifications: [
      makeNotif(
        claim.ownerId,
        "Klaim",
        "Klaim Disetujui",
        `Klaim ${id} untuk "${shorten(report?.description ?? claim.reportId)}" disetujui. Admin akan menetapkan jadwal serah terima.`,
      ),
      ...state.notifications,
    ],
  });
  return true;
}

export function rejectClaim(id: string, reason: string) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim || claim.status !== "Menunggu" || reason.trim().length < 3)
    return false;
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "Ditolak",
            decisionReason: reason.trim(),
            decidedAt: new Date().toISOString(),
          }
        : c,
    ),
    notifications: [
      makeNotif(
        claim.ownerId,
        "Klaim",
        "Klaim Ditolak",
        `Klaim ${id} ditolak. Alasan: ${reason.trim()}`,
      ),
      ...state.notifications,
    ],
  });
  return true;
}

/** Buat jadwal serah terima. Mengembalikan pesan error, atau null jika berhasil. */
export function createSchedule(
  claimId: string,
  input: { at: string; place: string; officer: string; note: string },
): string | null {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== "Disetujui") return "Klaim belum disetujui.";
  if (
    state.schedules.some(
      (s) => s.claimId === claimId && scheduleStatus(s) === "Terjadwal",
    )
  )
    return "Klaim ini sudah punya jadwal aktif.";
  const at = new Date(input.at);
  if (Number.isNaN(at.getTime())) return "Waktu tidak valid.";
  if (at.getTime() <= Date.now())
    return "Waktu serah terima harus di masa depan.";
  if (input.place.trim().length < 3) return "Isi tempat serah terima.";
  if (input.officer.trim().length < 3) return "Isi nama penanggung jawab.";
  const report = state.reports.find((r) => r.id === claim.reportId);
  const schedule: Schedule = {
    id: nextId(
      "JDW",
      state.schedules.map((s) => s.id),
    ),
    ownerId: claim.ownerId,
    claimId,
    title: shorten(report?.description ?? claim.reportId, 60),
    at: at.toISOString(),
    place: input.place.trim(),
    note: input.note.trim(),
    officer: input.officer.trim(),
    status: "Terjadwal",
  };
  commit({
    ...state,
    schedules: [schedule, ...state.schedules],
    notifications: [
      makeNotif(
        claim.ownerId,
        "Jadwal",
        "Jadwal Serah Terima Dibuat",
        `Serah terima "${schedule.title}" dijadwalkan di ${schedule.place}. Cek menu Jadwal untuk detailnya.`,
      ),
      ...state.notifications,
    ],
  });
  return null;
}

/** Batalkan jadwal (wajib alasan). Klaim tetap Disetujui, temuan tetap Dicadangkan. */
export function cancelSchedule(id: string, reason: string) {
  const sc = state.schedules.find((s) => s.id === id);
  if (!sc || scheduleStatus(sc) !== "Terjadwal" || reason.trim().length < 3)
    return false;
  commit({
    ...state,
    schedules: state.schedules.map((s) =>
      s.id === id
        ? { ...s, status: "Dibatalkan", cancelReason: reason.trim() }
        : s,
    ),
    notifications: [
      makeNotif(
        sc.ownerId,
        "Jadwal",
        "Jadwal Dibatalkan",
        `Jadwal ${id} dibatalkan. Alasan: ${reason.trim()}. Admin akan menetapkan jadwal pengganti.`,
      ),
      ...state.notifications,
    ],
  });
  return true;
}

/** Selesaikan serah terima: perlu konfirmasi pemilik DAN penyerah. */
export function completeHandover(
  scheduleId: string,
  ownerConfirmed: boolean,
  giverConfirmed: boolean,
) {
  if (!ownerConfirmed || !giverConfirmed) return false;
  const sc = state.schedules.find((s) => s.id === scheduleId);
  if (!sc || scheduleStatus(sc) !== "Terjadwal") return false;
  const claim = state.claims.find((c) => c.id === sc.claimId);
  const report = claim && state.reports.find((r) => r.id === claim.reportId);
  commit({
    ...state,
    schedules: state.schedules.map((s) =>
      s.id === scheduleId ? { ...s, status: "Selesai" } : s,
    ),
    claims: state.claims.map((c) =>
      c.id === sc.claimId ? { ...c, status: "Selesai" } : c,
    ),
    reports: state.reports.map((r) =>
      claim && r.id === claim.reportId ? { ...r, status: "Diserahkan" } : r,
    ),
    notifications: [
      makeNotif(
        sc.ownerId,
        "Jadwal",
        "Serah Terima Selesai",
        `Serah terima "${sc.title}" telah selesai. Terima kasih.`,
      ),
      ...(report
        ? [
            makeNotif(
              report.ownerId,
              "Laporan",
              "Barang Temuan Diserahkan",
              `Barang pada laporan ${report.id} telah diserahkan kepada pemiliknya. Terima kasih sudah membantu.`,
            ),
          ]
        : []),
      ...state.notifications,
    ],
  });
  return true;
}

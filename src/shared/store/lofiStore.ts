import { useSyncExternalStore } from "react";
import { OTHER_CATEGORY } from "../utils/reportOptions";
import { shorten } from "../utils/format";
import { generatePickupCode, pickupDeadlineFrom } from "../utils/handover";

export type ReportKind = "lost" | "found";
export type ReportStatus =
  | "Aktif"
  | "Menunggu"
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
export type NotifType = "Klaim" | "Pengambilan" | "Laporan" | "Sistem";

export type Report = {
  id: string;
  kode?: string;
  kind: ReportKind;
  ownerId: string;
  category: string;
  categoryOther: string;
  description: string;
  color: string;
  brand: string;
  location: string;
  area: string;
  areaId?: string;
  date: string;
  time: string;
  secrets: string[];
  status: ReportStatus;
  createdAt: string;
  photos: string[];
  photoIds?: string[];
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
  /** Kode pengambilan, terbit saat klaim disetujui. */
  pickupCode?: string;
  /** Batas pemilik mengambil barang. */
  pickupDeadline?: string;
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

const KEY = "lofi-dummy-store-v3";

function empty(): State {
  return { reports: [], claims: [], notifications: [] };
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
    status: input.kind === "lost" ? "Aktif" : "Menunggu",
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
        lost ? "Laporan Kehilangan Aktif" : "Laporan Temuan Diterima",
        lost
          ? `Laporan kehilangan "${shorten(input.description)}" (ID: ${report.id}) telah berhasil dibuat dan sedang aktif.`
          : `Laporan temuan "${shorten(input.description)}" (ID: ${report.id}) tercatat. Serahkan barang ke admin fakultas pada jam kerja dengan menyebut ID laporan. Laporan tampil di katalog setelah barang diterima admin.`,
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

/* ---------- tindakan admin (dummy) ---------- */

/** Setujui klaim: wajib menandai minimal satu ciri rahasia yang cocok. */
export function approveClaim(id: string, matched: number[]) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim || claim.status !== "Menunggu" || matched.length < 1) return false;
  const report = state.reports.find((r) => r.id === claim.reportId);
  const code = generatePickupCode();
  const deadline = pickupDeadlineFrom();
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "Disetujui",
            matchedSecrets: matched,
            decidedAt: new Date().toISOString(),
            pickupCode: code,
            pickupDeadline: deadline,
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
        `Klaim ${id} untuk "${shorten(report?.description ?? claim.reportId)}" disetujui. Datang ke admin fakultas pada jam kerja dengan membawa KTM dan kode pengambilan ${code}, paling lambat ${new Date(deadline).toLocaleDateString("id-ID", { dateStyle: "long" })}.`,
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

/** Admin menerima barang dari penemu: laporan menjadi Tersedia dan tampil di katalog. */
export function receiveItem(reportId: string): string | null {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report || report.kind !== "found") return "Laporan temuan tidak ditemukan.";
  if (report.status !== "Menunggu") return "Barang ini tidak sedang menunggu penyerahan.";
  commit({
    ...state,
    reports: state.reports.map((r) =>
      r.id === reportId ? { ...r, status: "Tersedia" } : r,
    ),
    notifications: [
      makeNotif(
        report.ownerId,
        "Laporan",
        "Barang Diterima Admin",
        `Barang pada laporan ${report.id} sudah diterima admin dan kini tampil di katalog. Terima kasih sudah membantu.`,
      ),
      ...state.notifications,
    ],
  });
  return null;
}

/** Selesaikan pengambilan: kode harus cocok dan KTM sudah diperiksa admin. */
export function completePickup(
  claimId: string,
  code: string,
  ktmChecked: boolean,
): string | null {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== "Disetujui") return "Klaim tidak siap diambil.";
  if (!ktmChecked) return "Centang bahwa KTM sudah diperiksa dan sesuai dengan akun pemilik.";
  if (code.trim().toUpperCase() !== (claim.pickupCode ?? ""))
    return "Kode pengambilan tidak cocok.";
  const report = state.reports.find((r) => r.id === claim.reportId);
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === claimId ? { ...c, status: "Selesai" } : c,
    ),
    reports: state.reports.map((r) =>
      r.id === claim.reportId ? { ...r, status: "Diserahkan" } : r,
    ),
    notifications: [
      makeNotif(
        claim.ownerId,
        "Pengambilan",
        "Barang Telah Diambil",
        `Pengambilan "${shorten(report?.description ?? claim.reportId)}" selesai. Terima kasih.`,
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
  return null;
}

/** Batas ambil terlewat: klaim dibatalkan dan barang kembali Tersedia. */
export function expireClaim(claimId: string): boolean {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== "Disetujui") return false;
  commit({
    ...state,
    claims: state.claims.map((c) =>
      c.id === claimId
        ? { ...c, status: "Dibatalkan", decisionReason: "Batas pengambilan terlewat." }
        : c,
    ),
    reports: state.reports.map((r) =>
      r.id === claim.reportId ? { ...r, status: "Tersedia" } : r,
    ),
    notifications: [
      makeNotif(
        claim.ownerId,
        "Klaim",
        "Klaim Dibatalkan",
        `Klaim ${claimId} dibatalkan karena batas pengambilan terlewat. Barang kembali tersedia di katalog.`,
      ),
      ...state.notifications,
    ],
  });
  return true;
}

import { callRpc } from "./rpc";
import type { DbClaimStatus, DbReportStatus } from "./mappers";

export type AdminArea = {
  area_id: string;
  nama_area: string;
  jenis_area: string;
};

export type AdminMe = {
  role: "admin_pusat" | "admin_fakultas";
  nama: string;
  email: string;
  areas: AdminArea[];
};

export type AdminDashboard = {
  temuan_menunggu: number;
  klaim_disetujui: number;
  temuan_tersedia: number;
  temuan_total: number;
  kehilangan_aktif: number;
  klaim_menunggu: number;
};

export type AdminReportItem = {
  jenis: "penemuan" | "kehilangan";
  id: string;
  kode: string;
  kategori: string;
  kategori_lainnya: string | null;
  deskripsi: string;
  warna: string | null;
  merek: string | null;
  lokasi: string;
  tanggal: string;
  jam: string | null;
  area_id: string;
  nama_area: string;
  status: DbReportStatus;
  created_at: string;
  diterima_at: string | null;
  ada_klaim: boolean;
  ciri_rahasia: string[];
  klaim_aktif: number;
  foto: { photo_id: string; storage_path: string }[];
};

export type AdminClaimItem = {
  claim_id: string;
  status: DbClaimStatus;
  bukti: string;
  alasan: string | null;
  ciri_cocok: number[];
  tanggal_pengajuan: string;
  decision_at: string | null;
  batas_ambil_at: string | null;
  diserahkan_at: string | null;
  pemutus: string | null;
  pemohon: { nama: string; email: string };
  temuan: {
    found_id: string;
    kode: string;
    kategori: string;
    kategori_lainnya: string | null;
    deskripsi: string;
    lokasi: string;
    area_id: string;
    nama_area: string;
    status: DbReportStatus;
  };
  ciri_rahasia: string[];
  konflik: boolean;
};

export type AdminAuditItem = {
  audit_id: string;
  waktu: string;
  pelaku: { nama: string | null; email: string | null; role: string | null };
  objek: string;
  kode: string | null;
  aksi: string;
  alasan: string | null;
  area_id: string | null;
  nama_area: string | null;
};

export function getAdminMe() {
  return callRpc<AdminMe>("rpc_admin_get_me");
}

export function getAdminDashboard() {
  return callRpc<AdminDashboard>("rpc_admin_dashboard");
}

export function listAdminReports(params?: {
  jenis?: "semua" | "kehilangan" | "penemuan";
  status?: DbReportStatus;
  areaId?: string;
}) {
  return callRpc<{
    jumlah: { kehilangan: number; penemuan: number };
    items: AdminReportItem[];
  }>("rpc_admin_list_reports", {
    p_jenis: params?.jenis ?? "semua",
    p_status: params?.status ?? null,
    p_area_id: params?.areaId ?? null,
  });
}

export function listAdminClaims(params?: {
  status?: DbClaimStatus;
  areaId?: string;
}) {
  return callRpc<{
    jumlah: Record<DbClaimStatus, number>;
    items: AdminClaimItem[];
  }>("rpc_admin_list_claims", {
    p_status: params?.status ?? null,
    p_area_id: params?.areaId ?? null,
  });
}

export function receiveFoundItem(foundId: string) {
  return callRpc<{
    found_id: string;
    kode: string;
    status: string;
    diterima_at: string;
    duplikat: boolean;
  }>("rpc_receive_found_item", { p_found_id: foundId });
}

export function approveClaimRpc(
  claimId: string,
  matchedSecrets: number[],
  reason: string,
) {
  return callRpc<{
    claim_id: string;
    status: string;
    status_temuan: string;
    batas_ambil_at: string;
    jumlah_ditolak_otomatis: number;
  }>("rpc_approve_claim", {
    p_claim_id: claimId,
    p_ciri_cocok: matchedSecrets,
    p_alasan: reason.trim(),
  });
}

export function rejectClaimRpc(claimId: string, reason: string) {
  return callRpc<{ claim_id: string; status: string }>("rpc_reject_claim", {
    p_claim_id: claimId,
    p_alasan: reason.trim(),
  });
}

export function cancelClaimAdminRpc(claimId: string, reason: string) {
  return callRpc<{ claim_id: string; status: string; status_temuan: string }>(
    "rpc_cancel_claim",
    { p_claim_id: claimId, p_alasan: reason.trim() },
  );
}

export function completePickupRpc(claimId: string, code: string) {
  return callRpc<{
    claim_id: string;
    status: string;
    status_temuan: string;
    diserahkan_at: string;
    duplikat: boolean;
  }>("rpc_complete_pickup", {
    p_claim_id: claimId,
    p_kode: code.trim(),
  });
}

export function listAdminAudit(params?: { areaId?: string; page?: number }) {
  return callRpc<{
    total: number;
    halaman: number;
    per_halaman: number;
    total_halaman: number;
    items: AdminAuditItem[];
  }>("rpc_admin_list_audit", {
    p_area_id: params?.areaId ?? null,
    p_halaman: params?.page ?? 1,
  });
}

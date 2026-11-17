import { supabase } from "./supabase";
import { callRpc, toServiceError } from "./rpc";
import { myClaimRowToClaim, type MyClaim, type MyClaimRow } from "./mappers";

export const MIN_EVIDENCE = 15;
export const MAX_EVIDENCE = 1000;
export const MIN_CANCEL_REASON = 3;
export const MAX_CANCEL_REASON = 1000;

const SELECT =
  "claim_id, found_id, ciri_kepemilikan, status, alasan, tanggal_pengajuan, decision_at, " +
  "found_reports(kode, kategori, kategori_lainnya, deskripsi, lokasi_temuan)";

export async function listMyClaims(userId: string): Promise<MyClaim[]> {
  const { data, error } = await supabase
    .from("claims")
    .select(SELECT)
    .eq("user_id", userId)
    .order("tanggal_pengajuan", { ascending: false });
  if (error) throw toServiceError(error);
  return (data as unknown as MyClaimRow[]).map(myClaimRowToClaim);
}

export async function listMyActiveClaimFoundIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("claims")
    .select("found_id")
    .eq("user_id", userId)
    .in("status", ["menunggu", "disetujui"]);
  if (error) throw toServiceError(error);
  return new Set((data as { found_id: string }[]).map((r) => r.found_id));
}

export async function submitClaim(foundId: string, evidence: string) {
  return callRpc<{ claim_id: string; status: string; duplikat: boolean }>(
    "rpc_submit_claim",
    { p_found_id: foundId, p_ciri_kepemilikan: evidence.trim() },
  );
}

export async function cancelClaim(claimId: string, reason: string) {
  return callRpc<{ claim_id: string; status: string }>("rpc_cancel_claim", {
    p_claim_id: claimId,
    p_alasan: reason.trim(),
  });
}

export async function foundIdsWithActiveClaim(foundIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  await Promise.all(
    foundIds.map(async (id) => {
      const { data, error } = await supabase.rpc("has_active_claim", { p_found_id: id });
      if (!error && data === true) result.add(id);
    }),
  );
  return result;
}
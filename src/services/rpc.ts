import { supabase } from "./supabase";

/** Kode error yang dipakai semua RPC (lihat public.rpc_error di supabase/schema). */
export type ServiceErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNKNOWN";

/** Error seragam dari service; `message` aman langsung ditampilkan ke pengguna. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

/** Bentuk balasan semua RPC: { ok: true, data } atau { ok: false, error }. */
type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

const KNOWN_CODES: ServiceErrorCode[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
];

function normalizeCode(code: string | undefined): ServiceErrorCode {
  return KNOWN_CODES.find((c) => c === code) ?? "UNKNOWN";
}

/**
 * Ubah error dari Supabase (PostgREST/PostgreSQL/jaringan) menjadi ServiceError.
 * Dipakai juga untuk insert/update langsung ke tabel, bukan hanya RPC.
 */
export function toServiceError(err: {
  code?: string;
  message?: string;
}): ServiceError {
  const msg = err.message ?? "";
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return new ServiceError(
      "NETWORK",
      "Koneksi terputus. Periksa internet Anda lalu coba lagi.",
    );
  if (err.code === "PGRST301" || /jwt/i.test(msg))
    return new ServiceError(
      "UNAUTHORIZED",
      "Sesi tidak valid. Silakan masuk kembali.",
    );
  if (err.code === "42501")
    return new ServiceError(
      "FORBIDDEN",
      "Anda tidak memiliki akses untuk tindakan ini.",
    );
  if (err.code === "23505")
    return new ServiceError("CONFLICT", "Data yang sama sudah tersimpan.");
  if (err.code === "23514" || err.code === "23502")
    return new ServiceError(
      "VALIDATION",
      "Isian belum memenuhi ketentuan. Periksa kembali formulir.",
    );
  if (msg.includes("Maximum 3 photos"))
    return new ServiceError("VALIDATION", "Maksimal 3 foto per laporan.");
  return new ServiceError("UNKNOWN", "Terjadi kesalahan. Coba lagi.");
}

/**
 * Panggil fungsi RPC Supabase dan kembalikan `data`-nya.
 * Melempar ServiceError bila RPC membalas { ok: false } atau request gagal.
 *
 * Contoh:
 *   const r = await callRpc<{ claim_id: string }>("rpc_submit_claim", {
 *     p_found_id: foundId,
 *     p_ciri_kepemilikan: evidence,
 *   });
 */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toServiceError(error);

  const res = data as RpcResult<T> | null;
  if (!res || typeof res !== "object" || !("ok" in res))
    throw new ServiceError("UNKNOWN", "Respons server tidak dikenali.");
  if (!res.ok)
    throw new ServiceError(
      normalizeCode(res.error?.code),
      res.error?.message || "Terjadi kesalahan. Coba lagi.",
    );
  return res.data;
}

/** Pesan yang siap ditampilkan untuk error apa pun. */
export function errorMessage(e: unknown): string {
  return e instanceof ServiceError
    ? e.message
    : "Terjadi kesalahan. Coba lagi.";
}
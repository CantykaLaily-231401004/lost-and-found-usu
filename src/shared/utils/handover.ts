/** Aturan serah terima barang: penemu menyerahkan ke admin, admin menyerahkan ke pemilik. */
export const HANDOVER_DEADLINE_DAYS = 3; // batas penemu menyerahkan barang (hari kerja)
export const PICKUP_DEADLINE_DAYS = 7; // batas pemilik mengambil setelah klaim disetujui
export const DEFAULT_WORKING_HOURS = "Senin–Jumat, 08.00–16.00 WIB";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I agar tidak tertukar

export function generatePickupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export function pickupDeadlineFrom(date = new Date()): string {
  return new Date(date.getTime() + PICKUP_DEADLINE_DAYS * 86_400_000).toISOString();
}

export function isPastDeadline(iso?: string): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

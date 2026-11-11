import type { BadgeTone } from "../../shared/components/Badge";
import type { ClaimStatus } from "../../shared/store/lofiStore";

export const card = "rounded-2xl border border-white/80 bg-white/90 shadow-sm";
export const smallBtn = "h-8! w-auto! rounded-full! px-4! text-[13px]!";
export const inputCls =
  "h-9 w-full rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20";

export const CLAIM_TONE: Record<ClaimStatus, BadgeTone> = {
  Menunggu: "amber",
  Disetujui: "green",
  Ditolak: "redSoft",
  Dibatalkan: "graySoft",
  Selesai: "soft",
};

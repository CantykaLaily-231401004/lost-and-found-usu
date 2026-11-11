import { useSyncExternalStore } from "react";

export type AdminRole = "pusat" | "fakultas";
export type AdminSession = { role: AdminRole; faculty: string } | null;

const KEY = "lofi-demo-admin";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: AdminSession } = {
  raw: null,
  value: null,
};

function get(): AdminSession {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* abaikan */
  }
  if (raw !== cache.raw) {
    let value: AdminSession = null;
    try {
      const p = raw ? JSON.parse(raw) : null;
      if (
        p &&
        (p.role === "pusat" || p.role === "fakultas") &&
        typeof p.faculty === "string"
      )
        value = { role: p.role, faculty: p.faculty };
    } catch {
      /* abaikan */
    }
    cache = { raw, value };
  }
  return cache.value;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Peran DEMO. Ganti dengan role dari tabel profiles Supabase saat backend siap. */
export function setDemoAdmin(session: AdminSession) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
  listeners.forEach((l) => l());
}

export function useAdminSession(): AdminSession {
  return useSyncExternalStore(subscribe, get, () => null);
}

export function useIsAdmin() {
  return useAdminSession() !== null;
}

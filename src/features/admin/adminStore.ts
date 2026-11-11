import { useSyncExternalStore } from "react";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { useAdminSession, type AdminRole } from "../../shared/hooks/useIsAdmin";
import {
  approveClaim,
  cancelSchedule,
  completeHandover,
  createSchedule,
  rejectClaim,
  useLofiStore,
  type Claim,
  type Report,
  type Schedule,
} from "../../shared/store/lofiStore";
import { formatDateTimeWIB, shorten } from "../../shared/utils/format";

export type AuditType = "Klaim" | "Temuan" | "Jadwal" | "Admin";
export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  actorRole: AdminRole;
  type: AuditType;
  action: string;
  object: string;
  note?: string;
  scope: string;
};
export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  faculty: string;
};
export type Actor = { name: string; role: AdminRole; faculty: string };

type State = { audit: AuditEntry[]; admins: AdminAccount[] };

const KEY = "lofi-admin-store-v1";
const seed: AdminAccount[] = [
  {
    id: "adm-1",
    name: "Admin Pusat",
    email: "admin.pusat@usu.ac.id",
    role: "pusat",
    faculty: "Area Umum Kampus",
  },
  {
    id: "adm-2",
    name: "Admin Fasilkom-TI",
    email: "admin.fasilkomti@usu.ac.id",
    role: "fakultas",
    faculty: "Fasilkom-TI",
  },
];

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>;
      return { audit: p.audit ?? [], admins: p.admins ?? seed };
    }
  } catch {
    /* abaikan */
  }
  return { audit: [], admins: seed };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* abaikan */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAdminStore() {
  return useSyncExternalStore(subscribe, () => state);
}

export function useAdminActor(): Actor | null {
  const { user } = useSessionUser();
  const s = useAdminSession();
  return s
    ? { name: user?.name ?? "Admin", role: s.role, faculty: s.faculty }
    : null;
}

export function inScope(s: { role: AdminRole; faculty: string }, area: string) {
  return s.role === "pusat" || area === s.faculty;
}

/** Data yang boleh dilihat admin yang sedang masuk (sesuai peran dan fakultas). */
export function useScoped() {
  const s = useAdminSession();
  const store = useLofiStore();
  if (!s)
    return {
      reports: [] as Report[],
      claims: [] as Claim[],
      schedules: [] as Schedule[],
    };
  const reports = store.reports.filter((r) => inScope(s, r.area));
  const rIds = new Set(reports.map((r) => r.id));
  const claims = store.claims.filter((c) => rIds.has(c.reportId));
  const cIds = new Set(claims.map((c) => c.id));
  const schedules = store.schedules.filter((sc) => cIds.has(sc.claimId));
  return { reports, claims, schedules };
}

function log(
  a: Actor,
  type: AuditType,
  action: string,
  object: string,
  note?: string,
  scope = "Area Umum Kampus",
) {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: a.name,
    actorRole: a.role,
    type,
    action,
    object,
    note,
    scope,
  };
  commit({ ...state, audit: [entry, ...state.audit] });
}

const describe = (id: string, text?: string) =>
  text ? `${id} — ${shorten(text, 48)}` : id;

/* ---------- tindakan admin yang dicatat ke riwayat ---------- */

export function actApprove(
  a: Actor,
  claim: Claim,
  report: Report | undefined,
  matched: number[],
) {
  if (!approveClaim(claim.id, matched)) return false;
  log(
    a,
    "Klaim",
    "menyetujui klaim",
    describe(claim.id, report?.description),
    "Bukti kepemilikan sesuai ciri rahasia.",
    report?.area,
  );
  return true;
}

export function actReject(
  a: Actor,
  claim: Claim,
  report: Report | undefined,
  reason: string,
) {
  if (!rejectClaim(claim.id, reason)) return false;
  log(
    a,
    "Klaim",
    "menolak klaim",
    describe(claim.id, report?.description),
    reason.trim(),
    report?.area,
  );
  return true;
}

export function actCreateSchedule(
  a: Actor,
  claim: Claim,
  report: Report | undefined,
  input: { at: string; place: string; officer: string; note: string },
): string | null {
  const err = createSchedule(claim.id, input);
  if (err) return err;
  log(
    a,
    "Jadwal",
    "membuat jadwal serah terima",
    describe(claim.id, report?.description),
    `Jadwal: ${formatDateTimeWIB(new Date(input.at).toISOString())}, ${input.place.trim()}`,
    report?.area,
  );
  return null;
}

export function actCancelSchedule(
  a: Actor,
  sc: Schedule,
  report: Report | undefined,
  reason: string,
) {
  if (!cancelSchedule(sc.id, reason)) return false;
  log(
    a,
    "Jadwal",
    "membatalkan jadwal",
    describe(sc.id, sc.title),
    reason.trim(),
    report?.area,
  );
  return true;
}

export function actComplete(
  a: Actor,
  sc: Schedule,
  report: Report | undefined,
  owner: boolean,
  giver: boolean,
) {
  if (!completeHandover(sc.id, owner, giver)) return false;
  log(
    a,
    "Jadwal",
    "menyelesaikan serah terima",
    describe(sc.id, sc.title),
    "Pemilik dan penyerah sudah mengonfirmasi.",
    report?.area,
  );
  return true;
}

/* ---------- pengelolaan admin (khusus admin pusat) ---------- */

export function addAdmin(
  a: Actor,
  input: { name: string; email: string; faculty: string },
): string | null {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3) return "Isi nama admin (minimal 3 karakter).";
  if (!/^[^\s@]+@(students\.)?usu\.ac\.id$/.test(email))
    return "Gunakan surel resmi kampus (@usu.ac.id atau @students.usu.ac.id).";
  if (!input.faculty) return "Pilih fakultas cakupan.";
  if (state.admins.some((x) => x.email === email))
    return "Surel ini sudah terdaftar sebagai admin.";
  const acc: AdminAccount = {
    id: crypto.randomUUID(),
    name,
    email,
    role: "fakultas",
    faculty: input.faculty,
  };
  commit({ ...state, admins: [...state.admins, acc] });
  log(
    a,
    "Admin",
    "menambahkan admin fakultas",
    `${name} — ${input.faculty}`,
    undefined,
    input.faculty,
  );
  return null;
}

export function removeAdmin(a: Actor, acc: AdminAccount) {
  if (acc.role === "pusat") return;
  commit({ ...state, admins: state.admins.filter((x) => x.id !== acc.id) });
  log(
    a,
    "Admin",
    "mencabut akses admin fakultas",
    `${acc.name} — ${acc.faculty}`,
    undefined,
    acc.faculty,
  );
}

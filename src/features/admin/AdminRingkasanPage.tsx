import Badge from "../../shared/components/Badge";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { scheduleStatus } from "../../shared/store/lofiStore";
import { formatDate, formatDateTime } from "../../shared/utils/format";
import AdminShell from "./AdminShell";
import { useAdminStore, useScoped } from "./adminStore";
import { CLAIM_TONE, card } from "./adminstyles";
import { PageTitle, Panel } from "./adminUI";

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MEI",
  "JUN",
  "JUL",
  "AGU",
  "SEP",
  "OKT",
  "NOV",
  "DES",
];

export default function AdminRingkasanPage() {
  const session = useAdminSession();
  const { reports, claims, schedules } = useScoped();
  const admin = useAdminStore();

  const found = reports.filter((r) => r.kind === "found");
  const countFound = (s: string) => found.filter((r) => r.status === s).length;
  const lostActive = reports.filter(
    (r) => r.kind === "lost" && r.status === "Aktif",
  ).length;
  const waiting = claims.filter((c) => c.status === "Menunggu").length;
  const active = schedules
    .filter((s) => scheduleStatus(s) === "Terjadwal")
    .sort((a, b) => a.at.localeCompare(b.at));
  const recent = [...claims]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const audit = admin.audit
    .filter(
      (e) =>
        !session || session.role === "pusat" || e.scope === session.faculty,
    )
    .slice(0, 5);

  const stats: {
    label: string;
    sub: string;
    n: number;
    icon: IconName;
    accent: boolean;
  }[] = [
    {
      label: "Barang Tersedia",
      sub: "Dapat diklaim",
      n: countFound("Tersedia"),
      icon: "box",
      accent: false,
    },
    {
      label: "Klaim Menunggu",
      sub: "Perlu diverifikasi",
      n: waiting,
      icon: "clipboard",
      accent: true,
    },
    {
      label: "Jadwal Aktif",
      sub: "Serah terima mendatang",
      n: active.length,
      icon: "calendar",
      accent: false,
    },
    {
      label: "Total Temuan",
      sub: "Semua waktu",
      n: found.length,
      icon: "search",
      accent: false,
    },
  ];

  const rows = [
    { label: "Tersedia", n: countFound("Tersedia"), bar: "bg-brand-700" },
    { label: "Dicadangkan", n: countFound("Dicadangkan"), bar: "bg-tag" },
    { label: "Aktif (Hilang)", n: lostActive, bar: "bg-red-400/70" },
    { label: "Diserahkan", n: countFound("Diserahkan"), bar: "bg-gray-400" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.n));

  const today = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
    new Date(),
  );

  return (
    <AdminShell>
      <PageTitle
        eyebrow={
          session?.role === "pusat"
            ? "Admin pusat · Semua kampus"
            : `Admin fakultas · ${session?.faculty ?? ""}`
        }
        title="Ringkasan Sistem"
        subtitle={today}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <span
              className={`flex size-9 items-center justify-center rounded-lg ${
                s.accent
                  ? "bg-tag/30 text-brand-950"
                  : "bg-brand-50 text-brand-800"
              }`}
            >
              <Icon name={s.icon} className="size-[18px]" />
            </span>
            <p className="mt-3 font-display text-3xl font-bold text-gray-900">
              {s.n}
            </p>
            <p className="text-sm font-medium text-gray-800">{s.label}</p>
            <p className="text-xs text-gray-500">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Klaim Terbaru"
          icon="clipboard"
          to="/admin/klaim"
          linkLabel="Verifikasi semua"
        >
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Belum ada klaim.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((c) => {
                const r = reports.find((x) => x.id === c.reportId);
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {r?.description ?? c.reportId}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.id} · {r?.location ?? "-"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={CLAIM_TONE[c.status]}>{c.status}</Badge>
                      <span className="hidden text-xs text-gray-400 sm:inline">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Status Barang" icon="info">
          <ul className="space-y-3 p-4">
            {rows.map((r) => (
              <li key={r.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{r.label}</span>
                  <span className="font-semibold text-gray-900">{r.n}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${r.bar}`}
                    style={{ width: `${(r.n / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Jadwal Mendatang"
          icon="calendar"
          to="/admin/jadwal"
          linkLabel="Kelola jadwal"
        >
          {active.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Tidak ada jadwal serah terima mendatang.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {active.slice(0, 3).map((s) => {
                const d = new Date(s.at);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-800 text-white">
                      <span className="text-base font-bold leading-none">
                        {d.getDate()}
                      </span>
                      <span className="text-[9px] font-medium">
                        {MONTHS[d.getMonth()]}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {s.title}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {s.place}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {d.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        })}{" "}
                        WIB
                      </p>
                      <p className="text-xs text-gray-500">{s.officer}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Aktivitas Terkini"
          icon="clock"
          to="/admin/riwayat"
          linkLabel="Riwayat lengkap"
        >
          {audit.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Belum ada aktivitas"
              body="Tindakan admin seperti menyetujui klaim atau membuat jadwal akan tercatat di sini."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {audit.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white">
                    {e.actor[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">
                      <strong>{e.actor}</strong> {e.action}
                    </p>
                    <p className="truncate text-xs text-gray-500">{e.object}</p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

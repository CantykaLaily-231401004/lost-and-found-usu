import { useEffect, useState } from "react";
import Badge from "../../shared/components/Badge";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { formatDate, formatDateTime } from "../../shared/utils/format";
import { claimStatusFromDb } from "../../services/mappers";
import {
  getAdminDashboard,
  listAdminAudit,
  listAdminClaims,
  listAdminReports,
  type AdminAuditItem,
  type AdminClaimItem,
  type AdminDashboard,
  type AdminReportItem,
} from "../../services/admin";
import { errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { CLAIM_TONE, card } from "./adminStyles";
import { PageTitle, Panel } from "./adminUi";

export default function AdminRingkasanPage() {
  const session = useAdminSession();
  const [dash, setDash] = useState<AdminDashboard | null>(null);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [claims, setClaims] = useState<AdminClaimItem[]>([]);
  const [audit, setAudit] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminDashboard(),
      listAdminReports(),
      listAdminClaims(),
      listAdminAudit({ page: 1 }),
    ])
      .then(([d, r, c, a]) => {
        if (!active) return;
        setDash(d);
        setReports(r.items);
        setClaims(c.items);
        setAudit(a.items.slice(0, 5));
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const found = reports.filter((r) => r.jenis === "penemuan");
  const countFound = (s: string) => found.filter((r) => r.status === s).length;
  const ready = claims
    .filter((c) => c.status === "disetujui")
    .sort((a, b) =>
      (a.batas_ambil_at ?? "").localeCompare(b.batas_ambil_at ?? ""),
    );
  const recent = [...claims]
    .sort((a, b) => b.tanggal_pengajuan.localeCompare(a.tanggal_pengajuan))
    .slice(0, 4);

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
      n: dash?.temuan_tersedia ?? 0,
      icon: "box",
      accent: false,
    },
    {
      label: "Klaim Menunggu",
      sub: "Perlu diverifikasi",
      n: dash?.klaim_menunggu ?? 0,
      icon: "clipboard",
      accent: true,
    },
    {
      label: "Menunggu Penyerahan",
      sub: "Barang belum diterima admin",
      n: dash?.temuan_menunggu ?? 0,
      icon: "box",
      accent: false,
    },
    {
      label: "Total Temuan",
      sub: "Semua waktu",
      n: dash?.temuan_total ?? 0,
      icon: "search",
      accent: false,
    },
  ];

  const rows = [
    {
      label: "Menunggu Penyerahan",
      n: dash?.temuan_menunggu ?? countFound("menunggu"),
      bar: "bg-amber-400",
    },
    {
      label: "Tersedia",
      n: dash?.temuan_tersedia ?? countFound("tersedia"),
      bar: "bg-brand-700",
    },
    { label: "Dicadangkan", n: countFound("dicadangkan"), bar: "bg-tag" },
    {
      label: "Aktif (Hilang)",
      n: dash?.kehilangan_aktif ?? 0,
      bar: "bg-red-400/70",
    },
    { label: "Diserahkan", n: countFound("diserahkan"), bar: "bg-gray-400" },
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

      {loadError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}{" "}
          <button
            type="button"
            onClick={reload}
            className="font-medium underline"
          >
            Coba lagi
          </button>
        </p>
      )}

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
              {loading ? "…" : s.n}
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
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Memuat...
            </p>
          ) : recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Belum ada klaim.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((c) => {
                const statusLabel = claimStatusFromDb(c.status);
                return (
                  <li
                    key={c.claim_id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {c.temuan.deskripsi}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.temuan.kode} · {c.temuan.lokasi}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={CLAIM_TONE[statusLabel]}>
                        {statusLabel}
                      </Badge>
                      <span className="hidden text-xs text-gray-400 sm:inline">
                        {formatDate(c.tanggal_pengajuan)}
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
                  <span className="font-semibold text-gray-900">
                    {loading ? "…" : r.n}
                  </span>
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
          title="Siap Diambil"
          icon="box"
          to="/admin/pengambilan"
          linkLabel="Kelola pengambilan"
        >
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Memuat...
            </p>
          ) : ready.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Tidak ada barang yang menunggu diambil pemilik.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {ready.slice(0, 3).map((c) => (
                <li
                  key={c.claim_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {c.temuan.deskripsi}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {c.temuan.kode} · {c.pemohon.nama}
                    </p>
                  </div>
                  {c.batas_ambil_at && (
                    <p className="shrink-0 text-xs text-gray-500">
                      Batas {formatDate(c.batas_ambil_at)}
                    </p>
                  )}
                </li>
              ))}
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
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Memuat...
            </p>
          ) : audit.length === 0 ? (
            <EmptyState
              icon="clock"
              title="Belum ada aktivitas"
              body="Tindakan admin seperti menyetujui klaim atau menerima barang akan tercatat di sini."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {audit.map((e) => (
                <li
                  key={e.audit_id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white">
                    {(e.pelaku.nama ?? "S")[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">
                      <strong>{e.pelaku.nama ?? "Sistem"}</strong>{" "}
                      {e.aksi.replace(/_/g, " ")}
                    </p>
                    {e.kode && (
                      <p className="truncate text-xs text-gray-500">{e.kode}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {formatDateTime(e.waktu)}
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

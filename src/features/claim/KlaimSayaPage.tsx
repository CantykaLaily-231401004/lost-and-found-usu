import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Badge, { type BadgeTone } from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  cancelClaim,
  useLofiStore,
  type Claim,
  type ClaimStatus,
} from "../../shared/store/lofiStore";
import { formatDateTime, shorten } from "../../shared/utils/format";

type Tab = "semua" | "Menunggu" | "Disetujui" | "Ditolak";

const TONE: Record<ClaimStatus, BadgeTone> = {
  Menunggu: "amber",
  Disetujui: "green",
  Ditolak: "redSoft",
  Dibatalkan: "graySoft",
  Selesai: "soft",
};

export default function KlaimSayaPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [tab, setTab] = useState<Tab>("semua");
  const [cancelling, setCancelling] = useState<Claim | null>(null);

  const mine = store.claims
    .filter((c) => c.ownerId === user?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const by = (s: ClaimStatus) => mine.filter((c) => c.status === s).length;
  const shown = tab === "semua" ? mine : mine.filter((c) => c.status === tab);

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            Klaim Saya
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Daftar pengajuan klaim barang temuan
          </p>
        </div>
        <Link to="/cari">
          <Button type="button" className="h-10 w-auto! text-sm">
            <Icon name="plus" className="size-4" /> Klaim Baru
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        <Tabs
          label="Status klaim"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: mine.length },
            { value: "Menunggu", label: "Menunggu", count: by("Menunggu") },
            { value: "Disetujui", label: "Disetujui", count: by("Disetujui") },
            { value: "Ditolak", label: "Ditolak", count: by("Ditolak") },
          ]}
        />
      </div>

      <div className="mt-5 space-y-4">
        {shown.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="Belum ada klaim"
            body="Temukan barang Anda di Cari Barang, lalu ajukan klaim dengan bukti kepemilikan."
            action={
              <Link to="/cari">
                <Button type="button" className="w-auto!">
                  Cari Barang
                </Button>
              </Link>
            }
          />
        ) : (
          shown.map((c) => {
            const report = store.reports.find((r) => r.id === c.reportId);
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[c.status]}>{c.status}</Badge>
                    <span className="font-mono text-xs text-gray-500">{c.id}</span>
                  </div>
                  {c.status === "Menunggu" && (
                    <button
                      type="button"
                      onClick={() => setCancelling(c)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
                <h2 className="mt-2 text-[15px] font-medium text-gray-900">
                  {report
                    ? `${shorten(report.description, 70)} — ${report.location}`
                    : c.reportId}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Diajukan: {formatDateTime(c.createdAt)}
                </p>
                <div className="mt-3 rounded-lg bg-surface px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    Bukti yang diajukan:
                  </p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">{c.evidence}</p>
                </div>
                {c.status === "Disetujui" && (
                  <p className="mt-3 rounded-lg border border-brand-700/30 bg-brand-50 px-4 py-3 text-sm text-brand-950">
                    Klaim disetujui. Jadwal serah terima akan dibuat oleh admin dan
                    muncul di menu Jadwal. Klaim yang sudah disetujui tidak bisa
                    dibatalkan langsung; hubungi admin.
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {cancelling && (
        <ConfirmDialog
          title="Batalkan klaim?"
          confirmLabel="Batalkan Klaim"
          danger
          onConfirm={() => {
            cancelClaim(cancelling.id);
            setCancelling(null);
          }}
          onCancel={() => setCancelling(null)}
        >
          <p>
            Klaim {cancelling.id} akan dibatalkan. Anda masih bisa mengajukan
            klaim baru untuk barang yang sama selama masih tersedia.
          </p>
        </ConfirmDialog>
      )}
    </AppShell>
  );
}

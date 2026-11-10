import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Select from "../../shared/components/Select";
import Tabs from "../../shared/components/Tabs";
import TextField from "../../shared/components/TextField";
import ReportThumb, {
  ReportKindBadge,
  ReportStatusBadge,
} from "../../shared/components/ReportThumb";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  categoryLabel,
  closeReport,
  hasActiveClaim,
  useLofiStore,
  type Report,
} from "../../shared/store/lofiStore";
import { formatDate, formatDateTime } from "../../shared/utils/format";

type Tab = "semua" | "lost" | "found";

const REASONS = [
  "Barang sudah ditemukan",
  "Laporan keliru atau duplikat",
  "Alasan lain",
] as const;

function isOpen(r: Report) {
  return r.status === "Aktif" || r.status === "Tersedia";
}

export default function LaporanSayaPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [tab, setTab] = useState<Tab>("semua");
  const [closing, setClosing] = useState<Report | null>(null);
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [reasonError, setReasonError] = useState("");

  const mine = store.reports
    .filter((r) => r.ownerId === user?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = tab === "semua" ? mine : mine.filter((r) => r.kind === tab);
  const count = (k: "lost" | "found") =>
    mine.filter((r) => r.kind === k).length;

  function openClose(r: Report) {
    setClosing(r);
    setReason("");
    setOther("");
    setReasonError("");
  }

  function confirmClose() {
    if (!closing) return;
    if (!reason) return setReasonError("Pilih alasan penutupan.");
    if (reason === "Alasan lain" && other.trim().length < 3)
      return setReasonError("Jelaskan alasan Anda (minimal 3 karakter).");
    closeReport(closing.id, reason === "Alasan lain" ? other.trim() : reason);
    setClosing(null);
  }

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
            Laporan Saya
          </h1>
          <p className="mt-1 text-[15px] text-gray-600">
            Semua laporan kehilangan dan penemuan yang Anda buat
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/lapor/kehilangan">
            <Button
              type="button"
              variant="outline"
              className="h-9! w-auto! whitespace-nowrap px-4! text-[13px]! sm:px-5!"
            >
              <Icon name="plus" className="size-4" />{" "}
              <span className="sm:hidden">Kehilangan</span>
              <span className="hidden sm:inline">Lapor Kehilangan</span>
            </Button>
          </Link>
          <Link to="/lapor/temuan">
            <Button
              type="button"
              className="h-9! w-auto! whitespace-nowrap px-4! text-[13px]! sm:px-5!"
            >
              <Icon name="plus" className="size-4" />{" "}
              <span className="sm:hidden">Penemuan</span>
              <span className="hidden sm:inline">Lapor Penemuan</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <Tabs
          label="Jenis laporan"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: mine.length },
            { value: "lost", label: "Kehilangan", count: count("lost") },
            { value: "found", label: "Penemuan", count: count("found") },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {shown.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="file"
              title="Belum ada laporan"
              body="Laporan yang Anda buat akan muncul di sini, lengkap dengan statusnya."
              action={
                <Link to="/lapor/kehilangan">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9! w-auto! px-4! text-[13px]!"
                  >
                    Buat laporan pertama
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          shown.map((r) => {
            const open = isOpen(r);
            const locked = r.kind === "found" && hasActiveClaim(store, r.id);
            const editPath =
              r.kind === "lost"
                ? `/lapor/kehilangan/${r.id}/ubah`
                : `/lapor/temuan/${r.id}/ubah`;
            return (
              <article
                key={r.id}
                className={`flex gap-3 rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-sm transition hover:shadow-md ${
                  open ? "" : "opacity-75"
                }`}
              >
                <ReportThumb
                  report={r}
                  className="size-16 shrink-0 rounded-lg sm:size-20"
                  iconClass="size-8"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReportKindBadge kind={r.kind} />
                    <ReportStatusBadge status={r.status} />
                    <span className="font-mono text-xs text-gray-500">
                      {r.id}
                    </span>
                  </div>
                  <h2 className="mt-2 text-sm font-semibold leading-5 text-gray-900">
                    {r.description}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {categoryLabel(r)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Icon name="pin" className="size-4" />
                      {r.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar" className="size-4" />
                      {formatDate(r.date)}
                    </span>
                    <span>Dibuat: {formatDateTime(r.createdAt)}</span>
                  </p>
                  {r.kind === "found" && r.secrets.length > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <Icon name="lock" className="size-4" />
                      {r.secrets.length} ciri rahasia tersimpan, hanya terlihat
                      oleh Anda dan admin.
                    </p>
                  )}
                  {r.closeReason && (
                    <p className="mt-1 text-sm text-gray-500">
                      Alasan ditutup: {r.closeReason}
                    </p>
                  )}
                  {open && !locked && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Link to={editPath}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8! w-auto! rounded-full! px-4! text-[13px]!"
                        >
                          Ubah
                        </Button>
                      </Link>
                      <button
                        type="button"
                        onClick={() => openClose(r)}
                        className="h-8 rounded-full px-3 text-[13px] text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                      >
                        Tutup Laporan
                      </button>
                    </div>
                  )}
                  {open && locked && (
                    <p className="mt-3 text-sm text-gray-500">
                      Ada klaim aktif. Perubahan dan penutupan hanya bisa lewat
                      admin.
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {closing && (
        <ConfirmDialog
          title="Tutup laporan?"
          confirmLabel="Tutup Laporan"
          danger
          onConfirm={confirmClose}
          onCancel={() => setClosing(null)}
        >
          <p>
            Laporan {closing.id} tidak bisa diubah lagi setelah ditutup. Riwayat
            tetap tersimpan.
          </p>
          <Select
            label="Alasan penutupan"
            placeholder="Pilih alasan"
            options={REASONS}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError("");
            }}
            error={reason === "Alasan lain" ? undefined : reasonError}
          />
          {reason === "Alasan lain" && (
            <TextField
              label="Jelaskan alasan"
              value={other}
              onChange={(e) => {
                setOther(e.target.value);
                setReasonError("");
              }}
              error={reasonError}
            />
          )}
        </ConfirmDialog>
      )}
    </AppShell>
  );
}

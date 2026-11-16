import { useCallback, useEffect, useState } from "react";
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
import { categoryLabel, type Report } from "../../shared/store/lofiStore";
import { formatDate, formatDateTime } from "../../shared/utils/format";
import { closeLostReport, listMyLostReports } from "../../services/lostReports";
import { closeFoundReport, listMyFoundReports } from "../../services/foundReports";
import { errorMessage } from "../../services/rpc";

const MIN_REASON = 10;
const MAX_REASON = 300;

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
  const [tab, setTab] = useState<Tab>("semua");
  const [closing, setClosing] = useState<Report | null>(null);
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);

  const [lostReports, setLostReports] = useState<Report[]>([]);
  const [foundReports, setFoundReports] = useState<Report[]>([]);
  const [lostState, setLostState] = useState<"loading" | "ready" | "error">("loading");
  const [foundState, setFoundState] = useState<"loading" | "ready" | "error">("loading");
  
  const [openSecrets, setOpenSecrets] = useState<Set<string>>(() => new Set());

  const [reloadKey, setReloadKey] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyLostReports(userId)
      .then((list) => {
        if (!active) return;
        setLostReports(list);
        setLostState("ready");
      })
      .catch(() => active && setLostState("error"));
    listMyFoundReports(userId)
      .then((list) => {
        if (!active) return;
        setFoundReports(list);
        setFoundState("ready");
      })
      .catch(() => active && setFoundState("error"));
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  /** Muat ulang daftar laporan kehilangan dan temuan dari database. */
  const loadLost = useCallback(() => setReloadKey((k) => k + 1), []);

  function toggleSecrets(id: string) {
    setOpenSecrets((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mine = [...lostReports, ...foundReports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const shown = tab === "semua" ? mine : mine.filter((r) => r.kind === tab);
  const count = (k: "lost" | "found") =>
    mine.filter((r) => r.kind === k).length;

  function openClose(r: Report) {
    setClosing(r);
    setReason("");
    setOther("");
    setReasonError("");
  }

  async function confirmClose() {
    if (!closing || closingBusy) return;
    if (!reason) return setReasonError("Pilih alasan penutupan.");
    if (reason === "Alasan lain" && other.trim().length < MIN_REASON)
      return setReasonError(`Jelaskan alasan Anda (minimal ${MIN_REASON} karakter).`);
    const text = reason === "Alasan lain" ? other.trim() : reason;
    setClosingBusy(true);
    try {
      if (closing.kind === "found") await closeFoundReport(closing.id, text);
      else await closeLostReport(closing.id, text);
      setClosing(null);
      loadLost();
    } catch (err) {
      setReasonError(errorMessage(err));
    } finally {
      setClosingBusy(false);
    }
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

      {(lostState === "error" || foundState === "error") && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {lostState === "error" && foundState === "error"
            ? "Laporan gagal dimuat."
            : lostState === "error"
              ? "Laporan kehilangan gagal dimuat."
              : "Laporan penemuan gagal dimuat."}{" "}
          <button type="button" onClick={loadLost} className="font-medium underline">
            Coba lagi
          </button>
        </p>
      )}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {lostState === "loading" || foundState === "loading" ? (
          <p className="text-sm text-gray-500 xl:col-span-2">Memuat laporan...</p>
        ) : shown.length === 0 ? (
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
            const secretsOpen = openSecrets.has(r.id);
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
                      {r.kode ?? r.id}
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
                      {r.time && `, ${r.time.replace(":", ".")} WIB`}
                    </span>
                    <span>Dibuat: {formatDateTime(r.createdAt)}</span>
                  </p>
                                    {r.kind === "found" && r.secrets.length > 0 && (
                    <div className="mt-1 text-sm text-gray-500">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <Icon name="lock" className="size-4" />
                        {r.secrets.length} ciri rahasia tersimpan, hanya terlihat
                        oleh Anda dan admin.
                        <button
                          type="button"
                          onClick={() => toggleSecrets(r.id)}
                          aria-expanded={secretsOpen}
                          className="font-medium text-brand-800 underline"
                        >
                          {secretsOpen ? "Sembunyikan" : "Lihat ciri rahasia"}
                        </button>
                      </p>
                      {secretsOpen && (
                        <ol className="mt-1.5 list-decimal space-y-0.5 rounded-lg bg-gray-50 py-2 pl-8 pr-3 text-gray-800">
                          {r.secrets.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                  {r.closeReason && (
                    <p className="mt-1 text-sm text-gray-500">
                      Alasan ditutup: {r.closeReason}
                    </p>
                  )}
                  {open && (
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
          onConfirm={() => void confirmClose()}
          onCancel={() => setClosing(null)}
        >
          <p>
            Laporan {closing.kode ?? closing.id} tidak bisa diubah lagi setelah
            ditutup. Riwayat tetap tersimpan.
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
              maxLength={MAX_REASON}
              hint={`${other.trim().length}/${MAX_REASON} karakter, minimal ${MIN_REASON}`}
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

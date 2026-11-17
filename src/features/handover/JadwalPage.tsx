import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Badge, { type BadgeTone } from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import TextArea from "../../shared/components/TextArea";
import TextField from "../../shared/components/TextField";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { categoryLabel } from "../../shared/store/lofiStore";
import { formatDateTimeWIB } from "../../shared/utils/format";
import {
  timestampToWib,
  type MySchedule,
  type MySchedulesData,
  type PendingPickup,
  type PickupStatus,
} from "../../services/mappers";
import { errorMessage, ServiceError } from "../../services/rpc";
import {
  cancelSchedule,
  confirmPickup,
  getMySchedules,
  MAX_CANCEL_REASON,
  MAX_PICKUP_NOTE,
  MIN_CANCEL_REASON,
  requestSchedule,
} from "../../services/schedules";

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

const TONE: Record<PickupStatus, BadgeTone> = {
  "Menunggu Persetujuan": "amber",
  Terjadwal: "soft",
  Selesai: "green",
  Dibatalkan: "graySoft",
};

const isActive = (s: MySchedule) =>
  s.status === "Menunggu Persetujuan" || s.status === "Terjadwal";

function nowWibLocal() {
  const { date, time } = timestampToWib(new Date().toISOString());
  return `${date}T${time}`;
}

type Dialog =
  | { kind: "request"; p: PendingPickup }
  | { kind: "cancel"; s: MySchedule }
  | { kind: "confirm"; s: MySchedule };

function ScheduleCard({
  s,
  onCancel,
  onConfirm,
}: {
  s: MySchedule;
  onCancel: (s: MySchedule) => void;
  onConfirm: (s: MySchedule) => void;
}) {
  const active = isActive(s);
  const { date } = timestampToWib(s.at);
  const [, month, day] = date.split("-");
  const waitingMe =
    s.status === "Terjadwal" && !!s.officerConfirmedAt && !s.ownerConfirmedAt;
  return (
    <article
      className={`rounded-2xl bg-white/90 p-4 shadow-sm transition hover:shadow-md ${
        active
          ? "border-2 border-brand-700"
          : "border border-white/80 opacity-75"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-white ${active ? "bg-brand-800" : "bg-gray-400"}`}
        >
          <span className="text-lg font-bold leading-none">{Number(day)}</span>
          <span className="text-[10px] font-medium">
            {MONTHS[Number(month) - 1]}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[s.status]}>{s.status}</Badge>
            {waitingMe && <Badge tone="red">Menunggu konfirmasi Anda</Badge>}
            <Link
              to={`/cari/${s.kode}`}
              className="font-mono text-xs text-gray-500 hover:underline"
            >
              {s.kode}
            </Link>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-gray-900">
            {categoryLabel(s)}
          </h3>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-surface px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
            <Icon name="clock" className="size-3.5" /> Waktu
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {formatDateTimeWIB(s.at)}
          </p>
        </div>
        <div className="rounded-lg bg-surface px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
            <Icon name="pin" className="size-3.5" /> Tempat
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {s.place || "Ditentukan admin saat menyetujui"}
          </p>
        </div>
      </div>
      {s.requestNote && (
        <p className="mt-3 text-sm text-gray-600">
          <strong>Catatan Anda:</strong> {s.requestNote}
        </p>
      )}
      {s.note && (
        <p className="mt-3 rounded-lg border border-brand-700/30 bg-brand-50 px-3.5 py-2 text-sm text-brand-950">
          <strong>Catatan admin:</strong> {s.note}
        </p>
      )}
      {s.officer && (
        <p className="mt-3 text-sm text-gray-500">
          Penanggung jawab: {s.officer} (Admin {s.area})
        </p>
      )}
      {s.status === "Dibatalkan" && s.cancelReason && (
        <p className="mt-2 text-sm text-gray-500">
          Alasan pembatalan: {s.cancelReason}
        </p>
      )}
      {s.status === "Selesai" && s.completedAt && (
        <p className="mt-2 text-sm text-gray-500">
          Barang diterima pada {formatDateTimeWIB(s.completedAt)}
        </p>
      )}
      {s.status === "Terjadwal" && s.ownerConfirmedAt && (
        <p className="mt-2 text-sm text-gray-500">
          Anda sudah mengonfirmasi penerimaan. Menunggu konfirmasi penyerahan
          dari admin.
        </p>
      )}
      {active && (
        <p className="mt-2 text-xs text-gray-500">
          Demi keamanan, bertemulah di lokasi kampus yang ramai, misalnya pos
          keamanan atau lobi fakultas.
        </p>
      )}
      {active && (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.status === "Terjadwal" && !s.ownerConfirmedAt && (
            <Button
              type="button"
              onClick={() => onConfirm(s)}
              className="h-9! w-auto! px-4! text-[13px]!"
            >
              <Icon name="check" className="size-4" /> Konfirmasi Penerimaan
              Barang
            </Button>
          )}
          {!s.officerConfirmedAt && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(s)}
              className="h-9! w-auto! px-4! text-[13px]!"
            >
              Batalkan
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

type Loaded = { key: string; data: MySchedulesData | null; error: string };

export default function JadwalPage() {
  const { user } = useSessionUser();
  const userId = user?.id;
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field?: string; message: string }>({
    message: "",
  });
  const [busy, setBusy] = useState(false);

  const requestKey = `${userId}|${reloadKey}`;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getMySchedules()
      .then((data) => active && setLoaded({ key: requestKey, data, error: "" }))
      .catch(
        (e) =>
          active &&
          setLoaded({ key: requestKey, data: null, error: errorMessage(e) }),
      );
    return () => {
      active = false;
    };
  }, [userId, requestKey]);

  const loading = !loaded || loaded.key !== requestKey;
  const all = loaded?.data?.schedules ?? [];
  const pendingList = loaded?.data?.pending ?? [];
  const waiting = loaded?.data?.waitingClaims ?? 0;

  const upcoming = all
    .filter(isActive)
    .sort((a, b) => a.at.localeCompare(b.at));
  const history = all
    .filter((s) => !isActive(s))
    .sort((a, b) => b.at.localeCompare(a.at));
  const awaiting = pendingList.length;

  const subtitle =
    upcoming.length > 0
      ? `${upcoming.length} jadwal pengambilan${awaiting > 0 ? `, ${awaiting} klaim belum diajukan waktunya` : ""}`
      : awaiting > 0
        ? "Klaim disetujui, ajukan waktu pengambilan barang"
        : waiting > 0
          ? "Klaim Anda sedang menunggu verifikasi admin"
          : history.length > 0
            ? "Tidak ada jadwal mendatang"
            : "Belum ada klaim yang diajukan";

  const empty =
    waiting > 0
      ? {
          title: "Belum ada jadwal pengambilan",
          body: "Klaim Anda masih menunggu verifikasi admin. Setelah disetujui, Anda bisa mengajukan waktu pengambilan di halaman ini.",
          to: "/klaim-saya",
          label: "Lihat Klaim Saya",
        }
      : history.length > 0
        ? {
            title: "Tidak ada jadwal mendatang",
            body: "Saat ini tidak ada pengambilan barang yang terjadwal untuk Anda.",
            to: "/klaim-saya",
            label: "Lihat Klaim Saya",
          }
        : {
            title: "Belum ada jadwal pengambilan",
            body: "Anda belum mengajukan klaim. Cari barang Anda, lalu ajukan klaim untuk memulai proses pengambilan.",
            to: "/cari",
            label: "Cari Barang",
          };

  function open(d: Dialog) {
    setDialog(d);
    setWhen("");
    setNote("");
    setReason("");
    setError({ message: "" });
  }

  async function submit() {
    if (!dialog || busy) return;
    if (dialog.kind === "request" && !when)
      return setError({ field: "waktu", message: "Pilih tanggal dan jam pengambilan." });
    if (dialog.kind === "cancel" && reason.trim().length < MIN_CANCEL_REASON)
      return setError({
        field: "alasan",
        message: `Tulis alasan pembatalan (minimal ${MIN_CANCEL_REASON} karakter).`,
      });
    setBusy(true);
    try {
      if (dialog.kind === "request")
        await requestSchedule(dialog.p.claimId, when, note);
      else if (dialog.kind === "cancel")
        await cancelSchedule(dialog.s.id, reason);
      else await confirmPickup(dialog.s.id);
      setDialog(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError({
        field: e instanceof ServiceError ? e.field : undefined,
        message: errorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  const generalError = error.message && !error.field ? error.message : "";

  return (
    <AppShell wide>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
          Jadwal Pengambilan Barang
        </h1>
        <p className="mt-1 text-[15px] text-gray-600">
          {loading ? "Memuat jadwal..." : subtitle}
        </p>
      </div>

      {loading ? null : loaded.error ? (
        <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loaded.error}{" "}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="font-medium underline"
          >
            Coba lagi
          </button>
        </p>
      ) : (
        <>
          {pendingList.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span className="size-2 rounded-full bg-tag" />
                Klaim disetujui
              </h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {pendingList.map((p) => (
                  <article
                    key={p.claimId}
                    className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green">Disetujui</Badge>
                      <Link
                        to={`/cari/${p.kode}`}
                        className="font-mono text-xs text-gray-500 hover:underline"
                      >
                        {p.kode}
                      </Link>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-gray-900">
                      {categoryLabel(p)}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Barang disimpan admin {p.area}. Ajukan waktu yang Anda
                      bisa, admin akan menyetujui atau menyesuaikannya.
                    </p>
                    <Button
                      type="button"
                      onClick={() => open({ kind: "request", p })}
                      className="mt-3 h-9! w-auto! px-4! text-[13px]!"
                    >
                      <Icon name="calendar" className="size-4" /> Ajukan Waktu
                      Pengambilan
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}

          <h2 className="mb-3 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            <span className="size-2 rounded-full bg-brand-700" />
            Jadwal mendatang
          </h2>

          {upcoming.length === 0 ? (
            pendingList.length > 0 ? (
              <p className="text-sm text-gray-500">
                Belum ada jadwal. Ajukan waktu pengambilan untuk klaim yang
                sudah disetujui.
              </p>
            ) : (
              <EmptyState
                icon="calendar"
                title={empty.title}
                body={empty.body}
                action={
                  <Link to={empty.to}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9! w-auto! px-4! text-[13px]!"
                    >
                      {empty.label}
                    </Button>
                  </Link>
                }
              />
            )
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {upcoming.map((s) => (
                <ScheduleCard
                  key={s.id}
                  s={s}
                  onCancel={(x) => open({ kind: "cancel", s: x })}
                  onConfirm={(x) => open({ kind: "confirm", s: x })}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span className="size-2 rounded-full bg-gray-400" />
                Riwayat
              </h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {history.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    s={s}
                    onCancel={() => {}}
                    onConfirm={() => {}}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {dialog && (
        <ConfirmDialog
          title={
            dialog.kind === "request"
              ? "Ajukan waktu pengambilan"
              : dialog.kind === "cancel"
                ? "Batalkan jadwal?"
                : "Konfirmasi penerimaan barang?"
          }
          confirmLabel={
            busy
              ? "Memproses..."
              : dialog.kind === "request"
                ? "Ajukan"
                : dialog.kind === "cancel"
                  ? "Batalkan Jadwal"
                  : "Ya, Barang Sudah Saya Terima"
          }
          danger={dialog.kind === "cancel"}
          onConfirm={submit}
          onCancel={() => !busy && setDialog(null)}
        >
          {dialog.kind === "request" && (
            <>
              <p>
                {dialog.p.kode} · {categoryLabel(dialog.p)}. Admin {dialog.p.area}{" "}
                akan menyetujui atau menyesuaikan waktu dengan jam layanan.
              </p>
              <TextField
                label="Tanggal dan jam pengambilan (WIB)"
                type="datetime-local"
                min={nowWibLocal()}
                value={when}
                onChange={(e) => {
                  setWhen(e.target.value);
                  setError({ message: "" });
                }}
                error={error.field === "waktu" ? error.message : undefined}
              />
              <TextArea
                label="Catatan untuk admin (opsional)"
                value={note}
                maxLength={MAX_PICKUP_NOTE}
                rows={3}
                placeholder="Cth: Saya bisa setelah kuliah pukul 10.00"
                onChange={(e) => {
                  setNote(e.target.value);
                  setError({ message: "" });
                }}
                error={error.field === "catatan" ? error.message : undefined}
              />
            </>
          )}
          {dialog.kind === "cancel" && (
            <>
              <p>
                {dialog.s.status === "Menunggu Persetujuan"
                  ? "Pengajuan"
                  : "Jadwal"}{" "}
                pengambilan {dialog.s.kode} dibatalkan. Klaim Anda tetap
                Disetujui dan Anda bisa mengajukan waktu baru.
              </p>
              <TextArea
                label="Alasan pembatalan"
                value={reason}
                maxLength={MAX_CANCEL_REASON}
                rows={3}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError({ message: "" });
                }}
                error={error.field === "alasan" ? error.message : undefined}
              />
            </>
          )}
          {dialog.kind === "confirm" && (
            <p>
              Tekan hanya setelah {dialog.s.kode} benar-benar Anda terima dari
              admin. Pengambilan selesai setelah Anda dan admin sama-sama
              mengonfirmasi.
            </p>
          )}
          {generalError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              {generalError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </AppShell>
  );
}
import { useState } from "react";
import Badge, { type BadgeTone } from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Select from "../../shared/components/Select";
import Tabs from "../../shared/components/Tabs";
import TextField from "../../shared/components/TextField";
import {
  scheduleStatus,
  type Claim,
  type Schedule,
  type ScheduleStatus,
} from "../../shared/store/lofiStore";
import { formatDateTimeWIB, shorten } from "../../shared/utils/format";
import AdminShell from "./AdminShell";
import {
  actCancelSchedule,
  actComplete,
  actCreateSchedule,
  useAdminActor,
  useScoped,
} from "./adminStore";
import { card, smallBtn } from "./adminstyles";
import { PageTitle } from "./adminUI";

type Tab = ScheduleStatus | "semua";
type Dialog =
  | { kind: "create" }
  | { kind: "cancel"; s: Schedule }
  | { kind: "complete"; s: Schedule };

const TONE: Record<ScheduleStatus, BadgeTone> = {
  Terjadwal: "soft",
  Selesai: "green",
  Dibatalkan: "graySoft",
};

export default function AdminJadwalPage() {
  const actor = useAdminActor();
  const { reports, claims, schedules } = useScoped();
  const [tab, setTab] = useState<Tab>("Terjadwal");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [claimSel, setClaimSel] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [officer, setOfficer] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [ownerOk, setOwnerOk] = useState(false);
  const [giverOk, setGiverOk] = useState(false);
  const [error, setError] = useState("");

  const reportOfClaim = (c: Claim) => reports.find((r) => r.id === c.reportId);
  const reportOfSchedule = (s: Schedule) => {
    const c = claims.find((x) => x.id === s.claimId);
    return c ? reportOfClaim(c) : undefined;
  };

  const needSchedule = claims.filter(
    (c) =>
      c.status === "Disetujui" &&
      !schedules.some(
        (s) => s.claimId === c.id && scheduleStatus(s) === "Terjadwal",
      ),
  );
  const claimLabel = (c: Claim) =>
    `${c.id} — ${shorten(reportOfClaim(c)?.description ?? c.reportId, 36)}`;

  const sorted = [...schedules].sort((a, b) => b.at.localeCompare(a.at));
  const count = (t: Tab) =>
    t === "semua"
      ? sorted.length
      : sorted.filter((s) => scheduleStatus(s) === t).length;
  const shown = sorted.filter(
    (s) => tab === "semua" || scheduleStatus(s) === tab,
  );

  function open(d: Dialog) {
    setDialog(d);
    setClaimSel("");
    setWhen("");
    setPlace("");
    setOfficer("");
    setNote("");
    setReason("");
    setOwnerOk(false);
    setGiverOk(false);
    setError("");
  }

  function confirm() {
    if (!dialog || !actor) return;
    if (dialog.kind === "create") {
      const c = needSchedule.find((x) => claimLabel(x) === claimSel);
      if (!c) return setError("Pilih klaim yang akan dijadwalkan.");
      const err = actCreateSchedule(actor, c, reportOfClaim(c), {
        at: when,
        place,
        officer,
        note,
      });
      if (err) return setError(err);
    } else if (dialog.kind === "cancel") {
      if (
        !actCancelSchedule(actor, dialog.s, reportOfSchedule(dialog.s), reason)
      )
        return setError("Tulis alasan pembatalan (minimal 3 karakter).");
    } else if (
      !actComplete(
        actor,
        dialog.s,
        reportOfSchedule(dialog.s),
        ownerOk,
        giverOk,
      )
    ) {
      return setError(
        "Kedua konfirmasi (pemilik dan penyerah) wajib dicentang.",
      );
    }
    setDialog(null);
  }

  return (
    <AdminShell>
      <PageTitle
        title="Jadwal Serah Terima"
        subtitle="Kelola jadwal pengambilan barang oleh pemilik"
        action={
          <Button
            type="button"
            disabled={needSchedule.length === 0}
            onClick={() => open({ kind: "create" })}
            className="h-9! w-auto! whitespace-nowrap px-4! text-[13px]! sm:px-5!"
          >
            <Icon name="plus" className="size-4" /> Buat Jadwal Baru
          </Button>
        }
      />
      {needSchedule.length > 0 && (
        <p className="mt-2 text-[13px] text-brand-800">
          {needSchedule.length} klaim disetujui menunggu jadwal.
        </p>
      )}

      <div className="mt-5">
        <Tabs
          label="Status jadwal"
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "Terjadwal",
              label: "Terjadwal",
              count: count("Terjadwal"),
            },
            { value: "Selesai", label: "Selesai", count: count("Selesai") },
            {
              value: "Dibatalkan",
              label: "Dibatalkan",
              count: count("Dibatalkan"),
            },
            { value: "semua", label: "Semua", count: count("semua") },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {shown.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="calendar"
              title="Tidak ada jadwal"
              body="Jadwal serah terima untuk klaim yang disetujui akan tampil di sini."
            />
          </div>
        ) : (
          shown.map((s) => {
            const st = scheduleStatus(s);
            const active = st === "Terjadwal";
            return (
              <article
                key={s.id}
                className={`${card} p-4 ${active ? "border-2 border-brand-700" : "opacity-75"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[st]}>{st}</Badge>
                    <span className="font-mono text-xs text-gray-500">
                      {s.id}
                    </span>
                  </div>
                  {active && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => open({ kind: "cancel", s })}
                        className={smallBtn}
                      >
                        Batalkan
                      </Button>
                      <Button
                        type="button"
                        onClick={() => open({ kind: "complete", s })}
                        className={smallBtn}
                      >
                        Selesaikan
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  {s.title}
                </h3>
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
                      <Icon name="pin" className="size-3.5" /> Lokasi
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {s.place}
                    </p>
                  </div>
                </div>
                {s.note && (
                  <p className="mt-2.5 rounded-lg border border-brand-700/30 bg-brand-50 px-3.5 py-2 text-sm text-brand-950">
                    <strong>Catatan:</strong> {s.note}
                  </p>
                )}
                <p className="mt-2.5 text-sm text-gray-500">
                  Penanggung jawab: {s.officer}
                </p>
                {s.cancelReason && (
                  <p className="mt-1 text-sm text-gray-500">
                    Alasan pembatalan: {s.cancelReason}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          title={
            dialog.kind === "create"
              ? "Buat jadwal serah terima"
              : dialog.kind === "cancel"
                ? "Batalkan jadwal?"
                : "Selesaikan serah terima?"
          }
          confirmLabel={
            dialog.kind === "create"
              ? "Simpan Jadwal"
              : dialog.kind === "cancel"
                ? "Batalkan Jadwal"
                : "Selesaikan"
          }
          danger={dialog.kind === "cancel"}
          onConfirm={confirm}
          onCancel={() => setDialog(null)}
        >
          {dialog.kind === "create" && (
            <>
              <Select
                label="Klaim disetujui"
                placeholder="Pilih klaim"
                options={needSchedule.map(claimLabel)}
                value={claimSel}
                onChange={(e) => {
                  setClaimSel(e.target.value);
                  setError("");
                }}
              />
              <TextField
                label="Waktu serah terima"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <TextField
                label="Tempat"
                placeholder="Cth: Pos keamanan Fasilkom-TI"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
              <TextField
                label="Penanggung jawab"
                placeholder="Nama petugas"
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
              />
              <TextField
                label="Catatan (opsional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                error={error}
              />
            </>
          )}

          {dialog.kind === "cancel" && (
            <>
              <p>
                Jadwal {dialog.s.id} dibatalkan. Klaim tetap Disetujui dan Anda
                bisa membuat jadwal pengganti.
              </p>
              <TextField
                label="Alasan pembatalan"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError("");
                }}
                error={error}
              />
            </>
          )}

          {dialog.kind === "complete" && (
            <>
              <p>
                Selesaikan jadwal {dialog.s.id}? Klaim menjadi Selesai dan
                temuan menjadi Diserahkan.
              </p>
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#2d7a4e]"
                  checked={ownerOk}
                  onChange={(e) => {
                    setOwnerOk(e.target.checked);
                    setError("");
                  }}
                />
                Pemilik sudah menerima barang
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#2d7a4e]"
                  checked={giverOk}
                  onChange={(e) => {
                    setGiverOk(e.target.checked);
                    setError("");
                  }}
                />
                Penyerah sudah menyerahkan barang
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

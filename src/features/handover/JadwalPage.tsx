import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Badge, { type BadgeTone } from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import PageBanner from "../../shared/components/PageBanner";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  scheduleStatus,
  schedulesOf,
  useLofiStore,
  type Schedule,
  type ScheduleStatus,
} from "../../shared/store/lofiStore";
import { formatDateTimeWIB } from "../../shared/utils/format";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

const TONE: Record<ScheduleStatus, BadgeTone> = {
  Terjadwal: "soft",
  Selesai: "green",
  Dibatalkan: "graySoft",
};

function ScheduleCard({ s }: { s: Schedule }) {
  const status = scheduleStatus(s);
  const active = status === "Terjadwal";
  const d = new Date(s.at);
  return (
    <article
      className={`rounded-2xl bg-white p-5 ${active ? "border-2 border-brand-700" : "border border-gray-200"}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-white ${active ? "bg-brand-800" : "bg-gray-400"}`}
        >
          <span className="text-xl font-bold leading-none">{d.getDate()}</span>
          <span className="text-[10px] font-medium">{MONTHS[d.getMonth()]}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={TONE[status]}>{status}</Badge>
            <span className="font-mono text-xs text-gray-500">{s.id}</span>
          </div>
          <h3 className="mt-1 font-medium text-gray-900">{s.title}</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
            <Icon name="clock" className="size-3.5" /> Waktu
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">{formatDateTimeWIB(s.at)}</p>
        </div>
        <div className="rounded-lg bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500">
            <Icon name="pin" className="size-3.5" /> Tempat
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">{s.place}</p>
        </div>
      </div>
      {s.note && (
        <p className="mt-3 rounded-lg border border-brand-700/30 bg-brand-50 px-4 py-2.5 text-sm text-brand-950">
          <strong>Catatan admin:</strong> {s.note}
        </p>
      )}
      <p className="mt-3 text-sm text-gray-500">Penanggung jawab: {s.officer}</p>
      {active && (
        <p className="mt-3 text-xs text-gray-500">
          Demi keamanan, bertemulah di lokasi kampus yang ramai, misalnya pos keamanan atau lobi
          fakultas.
        </p>
      )}
    </article>
  );
}

export default function JadwalPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();

  const all = schedulesOf(store, user?.id ?? "");
  const upcoming = all
    .filter((s) => scheduleStatus(s) === "Terjadwal")
    .sort((a, b) => a.at.localeCompare(b.at));
  const history = all
    .filter((s) => scheduleStatus(s) !== "Terjadwal")
    .sort((a, b) => b.at.localeCompare(a.at));

  const myClaims = store.claims.filter((c) => c.ownerId === user?.id);
  const pending = myClaims.filter((c) => c.status === "Menunggu").length;
  // Klaim disetujui tetapi belum punya jadwal aktif (belum dijadwalkan admin).
  const awaiting = myClaims.filter(
    (c) =>
      c.status === "Disetujui" &&
      !store.schedules.some((s) => s.claimId === c.id && scheduleStatus(s) === "Terjadwal"),
  ).length;

  const subtitle =
    upcoming.length > 0
      ? `${upcoming.length} jadwal serah terima${awaiting > 0 ? `, ${awaiting} klaim menunggu penjadwalan` : ""}`
      : awaiting > 0
        ? "Klaim disetujui, menunggu admin menetapkan jadwal"
        : pending > 0
          ? "Klaim Anda sedang menunggu verifikasi admin"
          : history.length > 0
            ? "Tidak ada jadwal mendatang"
            : "Belum ada klaim yang diajukan";

  const empty =
    awaiting > 0
      ? {
          title: "Menunggu penjadwalan",
          body: "Klaim Anda sudah disetujui. Admin akan menetapkan waktu dan tempat serah terima.",
          to: "/klaim-saya",
          label: "Lihat Klaim Saya",
        }
      : pending > 0
        ? {
            title: "Belum ada jadwal serah terima",
            body: "Klaim Anda masih menunggu verifikasi admin. Jadwal muncul setelah klaim disetujui dan admin menetapkan waktu serah terima.",
            to: "/klaim-saya",
            label: "Lihat Klaim Saya",
          }
        : myClaims.length > 0
          ? {
              title: "Tidak ada jadwal mendatang",
              body: "Saat ini tidak ada serah terima yang terjadwal untuk Anda.",
              to: "/klaim-saya",
              label: "Lihat Klaim Saya",
            }
          : {
              title: "Belum ada jadwal serah terima",
              body: "Anda belum mengajukan klaim. Cari barang Anda, lalu ajukan klaim untuk memulai proses serah terima.",
              to: "/cari",
              label: "Cari Barang",
            };

  return (
    <AppShell wide>
      <PageBanner
        eyebrow="Pantau jadwal"
        title="Jadwal Serah Terima"
        subtitle={subtitle}
        aside={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon name="calendar" className="size-6" />
          </span>
        }
      />

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        <span className="size-2 rounded-full bg-brand-700" />
        Jadwal mendatang
      </h2>

      {upcoming.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={empty.title}
          body={empty.body}
          action={
            <Link to={empty.to}>
              <Button type="button" variant="outline" className="w-auto!">
                {empty.label}
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {upcoming.map((s) => (
            <ScheduleCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            <span className="size-2 rounded-full bg-gray-400" />
            Riwayat
          </h2>
          <div className="space-y-4">
            {history.map((s) => (
              <ScheduleCard key={s.id} s={s} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

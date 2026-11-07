import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import PageBanner from "../../shared/components/PageBanner";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { useLofiStore } from "../../shared/store/lofiStore";
import { formatDateTime } from "../../shared/utils/format";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export default function JadwalPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();
  const mine = store.schedules
    .filter((s) => s.ownerId === user?.id)
    .sort((a, b) => a.at.localeCompare(b.at));

  return (
    <AppShell wide>
      <PageBanner
        eyebrow="Pantau jadwal"
        title="Jadwal Serah Terima"
        subtitle="Pengambilan barang setelah klaim disetujui"
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

      {mine.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Belum ada jadwal serah terima"
          body="Jadwal muncul di sini setelah klaim Anda disetujui dan admin menetapkan waktu serah terima."
          action={
            <Link to="/klaim-saya">
              <Button type="button" variant="outline" className="w-auto!">
                Lihat Klaim Saya
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {mine.map((s) => {
            const d = new Date(s.at);
            return (
              <article
                key={s.id}
                className="rounded-2xl border-2 border-brand-700 bg-white p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-800 text-white">
                    <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                    <span className="text-[10px] font-medium">{MONTHS[d.getMonth()]}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="soft">Terjadwal</Badge>
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
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatDateTime(s.at)}</p>
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
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

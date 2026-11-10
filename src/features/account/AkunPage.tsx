import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import Icon, { type IconName } from "../../shared/components/Icon";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { useLofiStore } from "../../shared/store/lofiStore";
import { supabase } from "../../services/supabase";
import { formatDate } from "../../shared/utils/format";

function Row({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <span className="flex items-center gap-2.5 text-sm text-gray-600">
        <Icon name={icon} className="size-4 text-brand-800" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

export default function AkunPage() {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [leaving, setLeaving] = useState(false);

  const id = user?.id;
  const stats = [
    {
      n: store.reports.filter((r) => r.ownerId === id).length,
      label: "Laporan",
      dot: "bg-brand-700",
    },
    {
      n: store.claims.filter((c) => c.ownerId === id).length,
      label: "Klaim",
      dot: "bg-tag",
    },
    {
      n: store.schedules.filter((s) => s.ownerId === id).length,
      label: "Jadwal",
      dot: "bg-brand-950",
    },
  ];

  async function signOut() {
    setLeaving(true);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <AppShell wide>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
          Akun Saya
        </h1>
        <p className="mt-1 text-[15px] text-gray-600">
          Profil dan informasi akun Anda
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[22rem_1fr]">
        {/* Kolom kiri: profil + statistik */}
        <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-800 text-2xl font-bold text-white">
              {user?.name[0]?.toUpperCase()}
              {user?.verified && (
                <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white bg-brand-700" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-gray-900">
                {user?.name}
              </p>
              <p className="truncate text-sm text-gray-600">{user?.email}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                <Icon name="checkCircle" className="size-3.5" />
                {user?.verified
                  ? "Surel Terverifikasi"
                  : "Surel Belum Terverifikasi"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-surface px-3 py-3 text-center"
              >
                <p className="font-display text-2xl font-bold text-gray-900">
                  {s.n}
                </p>
                <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-gray-600">
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Kolom kanan: informasi, catatan, keluar */}
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-display text-base font-semibold text-gray-900">
              <Icon name="user" className="size-[18px] text-brand-800" />{" "}
              Informasi Akun
            </h2>
            <Row icon="user" label="Nama Lengkap" value={user?.name ?? "-"} />
            <Row icon="mail" label="Alamat Surel" value={user?.email ?? "-"} />
            <Row icon="file" label="Peran" value="Pengguna Terdaftar" />
            <Row
              icon="checkCircle"
              label="Status Surel"
              value={user?.verified ? "Terverifikasi" : "Belum terverifikasi"}
            />
            <Row
              icon="calendar"
              label="Tanggal Verifikasi"
              value={user?.verifiedAt ? formatDate(user.verifiedAt) : "-"}
            />
          </section>

          <p className="rounded-xl border border-brand-700/30 bg-brand-50/80 px-3.5 py-2.5 text-[13px] leading-5 text-brand-950">
            Pemulihan kata sandi dan pengubahan surel dilakukan melalui tim
            teknis. Hubungi administrator institusi untuk perubahan data akun.
          </p>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200/80 bg-white/90 px-4 py-3.5">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-red-700">
                <Icon name="alert" className="size-[18px]" /> Keluar dari akun
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-600">
                Tindakan ini akan mengakhiri sesi Anda saat ini.
              </p>
            </div>
            <Button
              type="button"
              loading={leaving}
              onClick={signOut}
              className="h-9! w-auto! bg-red-600! px-4! text-[13px]! hover:bg-red-500!"
            >
              <Icon name="logout" className="size-4" />
              {leaving ? "Keluar..." : "Keluar"}
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

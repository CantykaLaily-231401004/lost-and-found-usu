import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import Icon, { type IconName } from "../../shared/components/Icon";
import PageBanner from "../../shared/components/PageBanner";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { schedulesOf, useLofiStore } from "../../shared/store/lofiStore";
import { supabase } from "../../services/supabase";
import { formatDate } from "../../shared/utils/format";

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
      <span className="flex items-center gap-3 text-sm text-gray-600">
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
    { n: store.reports.filter((r) => r.ownerId === id).length, label: "Laporan", cls: "bg-brand-700 text-white" },
    { n: store.claims.filter((c) => c.ownerId === id).length, label: "Klaim", cls: "bg-tag text-brand-950" },
    { n: schedulesOf(store, id ?? "").length, label: "Jadwal", cls: "bg-brand-950 text-white" },
  ];

  async function signOut() {
    setLeaving(true);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <AppShell wide>
      <PageBanner eyebrow="Profil pengguna" title="Akun Saya" />

      <div className="relative -mt-8 mb-4 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-md sm:mx-6">
        <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-2xl font-bold text-white">
          {user?.name[0]?.toUpperCase()}
          {user?.verified && (
            <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white bg-brand-700" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold text-gray-900">{user?.name}</p>
          <p className="truncate text-sm text-gray-600">{user?.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-800">
            <Icon name="checkCircle" className="size-3.5" />
            {user?.verified ? "Surel Terverifikasi" : "Surel Belum Terverifikasi"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl px-4 py-5 text-center ${s.cls}`}>
            <p className="text-3xl font-bold">{s.n}</p>
            <p className="text-sm opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-display text-lg font-semibold text-gray-900">
          <Icon name="user" className="size-5 text-brand-800" /> Informasi Akun
        </h2>
        <Row icon="user" label="Nama Lengkap" value={user?.name ?? "-"} />
        <Row icon="mail" label="Alamat Surel" value={user?.email ?? "-"} />
        <Row icon="file" label="Peran" value="Pengguna Terdaftar" />
        <Row icon="checkCircle" label="Status Surel" value={user?.verified ? "Terverifikasi" : "Belum terverifikasi"} />
        <Row icon="calendar" label="Tanggal Verifikasi" value={user?.verifiedAt ? formatDate(user.verifiedAt) : "-"} />
      </section>

      <p className="mt-4 rounded-xl border border-brand-700/30 bg-brand-50 px-4 py-3 text-sm text-brand-950">
        Pemulihan kata sandi dan pengubahan surel dilakukan melalui tim teknis.
        Hubungi administrator institusi untuk perubahan data akun.
      </p>

      <section className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-white">
        <h2 className="flex items-center gap-2 border-b border-red-100 px-5 py-4 font-display text-lg font-semibold text-red-700">
          <Icon name="alert" className="size-5" /> Zona Berbahaya
        </h2>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-600">Tindakan ini akan mengakhiri sesi Anda saat ini.</p>
          <Button
            type="button"
            loading={leaving}
            onClick={signOut}
            className="bg-red-600! hover:bg-red-500!"
          >
            <Icon name="logout" className="size-4" />
            {leaving ? "Keluar..." : "Keluar dari Akun"}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}

import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Icon, { type IconName } from "../../shared/components/Icon";
import { useSessionUser } from "../../shared/hooks/useSessionUser";

const ACTIONS: {
  to: string;
  title: string;
  body: string;
  icon: IconName;
  tone: string;
}[] = [
  {
    to: "/lapor/kehilangan",
    title: "Lapor Kehilangan",
    body: "Barang Anda hilang? Catat ciri, lokasi terakhir, dan foto supaya mudah ditemukan.",
    icon: "alert",
    tone: "bg-red-50 text-red-600",
  },
  {
    to: "/lapor/temuan",
    title: "Lapor Temuan",
    body: "Menemukan barang milik orang lain? Laporkan dan simpan ciri rahasia untuk verifikasi pemilik.",
    icon: "checkCircle",
    tone: "bg-tag/25 text-brand-950",
  },
];

export default function BerandaPage() {
  const { user } = useSessionUser();
  const first = user?.name.split(" ")[0];

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
        {first ? `Halo, ${first}` : "Beranda"}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Apa yang ingin Anda lakukan hari ini?
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-brand-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <span
              className={`flex size-11 items-center justify-center rounded-xl ${a.tone}`}
            >
              <Icon name={a.icon} className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold text-gray-900">
              {a.title}
            </h2>
            <p className="mt-1 flex-1 text-sm leading-6 text-gray-600">
              {a.body}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-800">
              Buat laporan
              <Icon
                name="arrowRight"
                className="size-4 transition group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

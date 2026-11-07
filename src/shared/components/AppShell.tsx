import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon, { type IconName } from "./Icon";
import { useSessionUser } from "../hooks/useSessionUser";
import { useLofiStore } from "../store/lofiStore";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/cari", label: "Cari Barang", icon: "search" },
  { to: "/laporan-saya", label: "Laporan Saya", icon: "file" },
  { to: "/klaim-saya", label: "Klaim Saya", icon: "clipboard" },
  { to: "/jadwal", label: "Jadwal", icon: "calendar" },
  { to: "/notifikasi", label: "Notifikasi", icon: "bell" },
  { to: "/akun", label: "Akun", icon: "user" },
];

function Avatar({ name }: { name?: string }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-tag text-sm font-bold text-brand-950">
      {name ? name[0].toUpperCase() : ""}
    </span>
  );
}

export default function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const { user, ready } = useSessionUser();
  const store = useLofiStore();
  const unread = user
    ? store.notifications.filter((n) => n.ownerId === user.id && !n.read).length
    : 0;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20">
        <div className="flex h-14 items-center justify-between bg-gradient-to-r from-brand-950 via-brand-800 to-brand-700 px-4 text-white sm:px-6">
          <Link to={user ? "/cari" : "/"} className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-tag text-brand-950">
              <Icon name="search" className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold">
                LoFi USU
              </span>
              <span className="hidden text-[11px] text-white/70 sm:block">
                Universitas Sumatera Utara
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/notifikasi"
              aria-label={
                unread > 0
                  ? `Notifikasi, ${unread} belum dibaca`
                  : "Notifikasi"
              }
              className="relative"
            >
              <Icon name="bell" className="size-6" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-tag text-[10px] font-bold text-brand-950">
                  {unread}
                </span>
              )}
            </Link>
            {user ? (
              <span className="flex items-center gap-2 text-sm">
                <Avatar name={user.name} />
                <span className="hidden max-w-32 truncate sm:inline">
                  {user.name}
                </span>
              </span>
            ) : (
              ready && (
                <Link
                  to="/login"
                  className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium hover:bg-white/25"
                >
                  Masuk
                </Link>
              )
            )}
          </div>
        </div>

        <div className="flex h-12 items-center gap-2 overflow-x-auto bg-brand-950 px-4 sm:gap-3 sm:px-6">
          <span className="hidden shrink-0 text-xs text-white/60 sm:inline">
            Laporan cepat:
          </span>
          <Link
            to="/lapor/kehilangan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            <Icon name="alert" className="size-3.5" />
            Lapor Kehilangan
          </Link>
          <Link
            to="/lapor/temuan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tag px-3.5 py-1.5 text-xs font-semibold text-brand-950 hover:brightness-95"
          >
            <Icon name="checkCircle" className="size-3.5" />
            Lapor Temuan
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-[6.5rem] hidden h-[calc(100vh-6.5rem)] w-60 shrink-0 flex-col justify-between p-3 lg:flex">
          <nav className="space-y-1 rounded-xl bg-white p-2 shadow-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-brand-800 font-medium text-white"
                      : "text-gray-700 hover:bg-brand-50"
                  }`
                }
              >
                <Icon name={n.icon} className="size-5" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <Avatar name={user.name} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-gray-900">
                  {user.name}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className={`size-1.5 rounded-full ${user.verified ? "bg-brand-700" : "bg-gray-400"}`}
                  />
                  {user.verified ? "Terverifikasi" : "Belum terverifikasi"}
                </p>
              </div>
            </div>
          ) : (
            <span />
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-8">
          <div
            className={`mx-auto w-full ${wide ? "max-w-[64rem]" : "max-w-[42rem]"}`}
          >
            {children}
          </div>
        </main>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-gray-200 bg-white lg:hidden"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? "font-medium text-brand-800" : "text-gray-500"
              }`
            }
          >
            <Icon name={n.icon} className="size-5" />
            <span className="max-w-full truncate px-0.5">
              {n.label.replace(" Barang", "").replace(" Saya", "")}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

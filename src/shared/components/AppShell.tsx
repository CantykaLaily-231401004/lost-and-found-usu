import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Icon, { type IconName } from "./Icon";
import { useSessionUser } from "../hooks/useSessionUser";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useLofiStore } from "../store/lofiStore";
import { supabase } from "../../services/supabase";

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
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tag text-sm font-bold text-brand-950">
      {name ? name[0].toUpperCase() : ""}
    </span>
  );
}

function QuickActions({ className = "" }: { className?: string }) {
  return (
    <div className={`gap-2 ${className}`}>
      <Link
        to="/lapor/kehilangan"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-red-300/30 bg-red-400/15 px-3.5 text-sm font-medium text-red-100 transition hover:bg-red-400/25"
      >
        <Icon name="alert" className="size-4" />
        Lapor Kehilangan
      </Link>
      <Link
        to="/lapor/temuan"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-tag/90 px-3.5 text-sm font-medium text-brand-950 transition hover:bg-tag"
      >
        <Icon name="checkCircle" className="size-4" />
        Lapor Temuan
      </Link>
    </div>
  );
}

export default function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const navigate = useNavigate();
  const { user, ready } = useSessionUser();
  const store = useLofiStore();
  const isAdmin = useIsAdmin();
  const items = isAdmin
    ? [...NAV, { to: "/admin", label: "Admin", icon: "lock" as IconName }]
    : NAV;
  const unread = user
    ? store.notifications.filter((n) => n.ownerId === user.id && !n.read).length
    : 0;

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 px-4 pt-3 text-white sm:px-6">
        <div className="flex h-12 items-center justify-between gap-3">
          <Link to={user ? "/cari" : "/"} className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-tag text-brand-950">
              <Icon name="search" className="size-4" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold">
                LoFi USU
              </span>
              <span className="hidden text-[11px] text-white/60 sm:block">
                Universitas Sumatera Utara
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              to="/notifikasi"
              aria-label={
                unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"
              }
              title="Notifikasi"
              className="relative rounded-full p-2.5 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name="bell" className="size-6" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-tag text-[10px] font-bold text-brand-950">
                  {unread}
                </span>
              )}
            </Link>
            {user ? (
              <>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Keluar"
                  title="Keluar"
                  className="rounded-full p-2.5 text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon name="logout" className="size-6" />
                </button>
                <Link to="/akun" aria-label="Akun" className="ml-1 lg:hidden">
                  <Avatar name={user.name} />
                </Link>
              </>
            ) : (
              ready && (
                <Link
                  to="/login"
                  className="rounded-full bg-tag px-4 py-1.5 text-sm font-medium text-brand-950 hover:brightness-95"
                >
                  Masuk
                </Link>
              )
            )}
          </div>
        </div>
        <QuickActions className="flex items-center justify-center pt-2 lg:hidden" />
      </header>

      <div className="flex min-h-0 flex-1 gap-4 pt-3 lg:px-4">
        <aside className="hidden w-48 shrink-0 flex-col justify-between pb-4 lg:flex">
          <nav className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-sm">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-white/15 font-medium text-white ring-1 ring-inset ring-white/20"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon name={n.icon} className="size-[18px]" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-3">
            <QuickActions className="flex flex-col" />
            {user && (
              <Link
                to="/akun"
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white backdrop-blur-sm hover:bg-white/10"
              >
                <Avatar name={user.name} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
                    <span
                      className={`size-1.5 rounded-full ${user.verified ? "bg-emerald-400" : "bg-white/40"}`}
                    />
                    {user.verified ? "Terverifikasi" : "Belum terverifikasi"}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pb-4">
          <div className="paper h-full overflow-y-auto rounded-t-3xl px-4 pb-24 pt-5 text-gray-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] sm:px-8 lg:rounded-3xl lg:pb-8 lg:pt-6">
            <div
              className={`mx-auto w-full ${wide ? "max-w-[62rem]" : "max-w-[42rem]"}`}
            >
              {children}
            </div>
          </div>
        </main>
      </div>

      <nav
        aria-label="Navigasi utama"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden"
      >
        {items.map((n) => (
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

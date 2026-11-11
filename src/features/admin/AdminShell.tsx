import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import { setDemoAdmin, useAdminSession } from "../../shared/hooks/useIsAdmin";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { supabase } from "../../services/supabase";

const NAV: {
  to: string;
  label: string;
  short: string;
  icon: IconName;
  end?: boolean;
  pusatOnly?: boolean;
}[] = [
  {
    to: "/admin",
    label: "Ringkasan",
    short: "Ringkasan",
    icon: "info",
    end: true,
  },
  { to: "/admin/temuan", label: "Temuan", short: "Temuan", icon: "box" },
  {
    to: "/admin/klaim",
    label: "Verifikasi Klaim",
    short: "Klaim",
    icon: "clipboard",
  },
  {
    to: "/admin/jadwal",
    label: "Jadwal Serah Terima",
    short: "Jadwal",
    icon: "calendar",
  },
  {
    to: "/admin/riwayat",
    label: "Riwayat Tindakan",
    short: "Riwayat",
    icon: "clock",
  },
  {
    to: "/admin/pengelolaan",
    label: "Pengelolaan Admin",
    short: "Admin",
    icon: "user",
    pusatOnly: true,
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const session = useAdminSession();

  if (!session) {
    return (
      <AppShell>
        <EmptyState
          icon="lock"
          title="Khusus admin"
          body="Halaman ini untuk admin pusat dan admin fakultas. Untuk uji coba sebelum backend siap, pilih peran demo di bawah."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                onClick={() =>
                  setDemoAdmin({ role: "pusat", faculty: "Area Umum Kampus" })
                }
                className="h-9! w-auto! px-4! text-[13px]!"
              >
                Admin Pusat (demo)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDemoAdmin({ role: "fakultas", faculty: "Fasilkom-TI" })
                }
                className="h-9! w-auto! px-4! text-[13px]!"
              >
                Admin Fasilkom-TI (demo)
              </Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  const items = NAV.filter((n) => !n.pusatOnly || session.role === "pusat");
  const roleText =
    session.role === "pusat"
      ? "Admin Pusat"
      : `Admin Fakultas · ${session.faculty}`;

  async function signOut() {
    setDemoAdmin(null);
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-bg flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 px-4 pt-3 text-white sm:px-6">
        <div className="flex h-12 items-center justify-between gap-3">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-tag text-brand-950">
              <Icon name="search" className="size-4" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-bold">
                LoFi USU
              </span>
              <span className="block text-[11px] text-white/60">
                {roleText}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Keluar"
            title="Keluar"
            className="rounded-full p-2.5 text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="logout" className="size-6" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 pt-3 lg:px-4">
        <aside className="hidden w-52 shrink-0 flex-col justify-between pb-4 lg:flex">
          <nav className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-sm">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
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

          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white backdrop-blur-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tag text-sm font-bold text-brand-950">
                {user?.name?.[0]?.toUpperCase() ?? "A"}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium">
                  {user?.name ?? "Admin"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/60">
                  {roleText}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between px-1 text-xs text-white/60">
              <Link to="/cari" className="hover:text-white">
                Tampilan pengguna
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDemoAdmin(null);
                  navigate("/cari");
                }}
                className="hover:text-white"
              >
                Keluar mode admin
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pb-4">
          <div className="paper h-full overflow-y-auto rounded-t-3xl px-4 pb-24 pt-5 text-gray-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] sm:px-8 lg:rounded-3xl lg:pb-8 lg:pt-6">
            <div className="mx-auto w-full max-w-[62rem]">{children}</div>
          </div>
        </main>
      </div>

      <nav
        aria-label="Navigasi admin"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden"
      >
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? "font-medium text-brand-800" : "text-gray-500"
              }`
            }
          >
            <Icon name={n.icon} className="size-5" />
            <span className="max-w-full truncate px-0.5">{n.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

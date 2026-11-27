import { useCallback, useEffect, useState } from "react";
import AppShell from "../../shared/components/AppShell";
import Badge from "../../shared/components/Badge";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import type { NotifType } from "../../shared/store/lofiStore";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeMyNotifications,
  type AppNotification,
} from "../../services/notifications";
import { errorMessage } from "../../services/rpc";
import { formatDate } from "../../shared/utils/format";

type Tab = "semua" | NotifType;

const ICON: Record<NotifType, IconName> = {
  Laporan: "file",
  Klaim: "clipboard",
  Pengambilan: "box",
  Sistem: "info",
};

const TYPES: NotifType[] = ["Klaim", "Pengambilan", "Laporan", "Sistem"];

export default function NotifikasiPage() {
  const { user } = useSessionUser();
  const [tab, setTab] = useState<Tab>("semua");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listMyNotifications();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void load();

    // Notifikasi baru muncul langsung (realtime), plus cek ulang tiap 30 detik
    const unsubscribe = subscribeMyNotifications(user.id, (n) =>
      setItems((prev) =>
        prev.some((p) => p.id === n.id) ? prev : [n, ...prev],
      ),
    );
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [user?.id, load]);

  const mine = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = mine.filter((n) => !n.read).length;
  const unreadOf = (t: NotifType) =>
    mine.filter((n) => n.type === t && !n.read).length;
  const shown = tab === "semua" ? mine : mine.filter((n) => n.type === tab);

  async function handleRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  }

  // Buka kartu pop-up; notifikasi dianggap dibaca setelah pop-up terbuka
  function openNotif(n: AppNotification) {
    setSelectedId(n.id);
    if (!n.read) void handleRead(n.id);
  }

  const selected = items.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  async function handleReadAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  }

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
            Notifikasi
          </h1>
          <p className="mt-1 text-[15px] text-gray-600">
            {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        <button
          type="button"
          disabled={unread === 0}
          onClick={() => void handleReadAll()}
          className="rounded-full border border-brand-800/25 bg-white/70 px-4 py-1.5 text-[13px] font-medium text-brand-800 transition hover:bg-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
        >
          Baca semua
        </button>
      </div>

      <div className="mt-5">
        <Tabs
          label="Jenis notifikasi"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: unread },
            ...TYPES.map((t) => ({ value: t, label: t, count: unreadOf(t) })),
          ]}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Memuat notifikasi…</p>
        ) : shown.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Belum ada notifikasi"
            body="Pembaruan tentang laporan, klaim, dan pengambilan barang Anda akan muncul di sini."
          />
        ) : (
          shown.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openNotif(n)}
              className={`flex w-full gap-3 rounded-2xl bg-white/90 p-3.5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 ${
                n.read
                  ? "border border-white/80 opacity-75"
                  : "border border-white/80 border-l-4 border-l-brand-700"
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-800">
                <Icon name={ICON[n.type]} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Badge tone={n.read ? "graySoft" : "green"}>{n.type}</Badge>
                    {!n.read && (
                      <>
                        <span className="size-2 rounded-full bg-brand-700" />
                        <span className="sr-only">Belum dibaca</span>
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDate(n.createdAt)}
                  </span>
                </span>
                <span
                  className={`mt-1 block text-sm text-gray-900 ${n.read ? "font-medium" : "font-semibold"}`}
                >
                  {n.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-gray-600">
                  {n.body}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-800">
                <Icon name={ICON[selected.type]} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <Badge tone="green">{selected.type}</Badge>
                <h2 className="mt-1.5 text-base font-semibold text-gray-900">
                  {selected.title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatDate(selected.createdAt)}
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
              {selected.body}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setSelectedId(null)}
                className="rounded-full bg-brand-700 px-5 py-1.5 text-[13px] font-medium text-white transition hover:bg-brand-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

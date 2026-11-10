import { useState } from "react";
import AppShell from "../../shared/components/AppShell";
import Badge from "../../shared/components/Badge";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  markAllRead,
  markRead,
  useLofiStore,
  type NotifType,
} from "../../shared/store/lofiStore";
import { formatDate } from "../../shared/utils/format";

type Tab = "semua" | NotifType;

const ICON: Record<NotifType, IconName> = {
  Laporan: "file",
  Klaim: "clipboard",
  Jadwal: "calendar",
  Sistem: "info",
};

const TYPES: NotifType[] = ["Klaim", "Jadwal", "Laporan", "Sistem"];

export default function NotifikasiPage() {
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [tab, setTab] = useState<Tab>("semua");

  const mine = store.notifications
    .filter((n) => n.ownerId === user?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = mine.filter((n) => !n.read).length;
  const unreadOf = (t: NotifType) =>
    mine.filter((n) => n.type === t && !n.read).length;
  const shown = tab === "semua" ? mine : mine.filter((n) => n.type === tab);

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
          onClick={() => user && markAllRead(user.id)}
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

      <div className="mt-4 space-y-2.5">
        {shown.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Belum ada notifikasi"
            body="Pembaruan tentang laporan, klaim, dan jadwal serah terima Anda akan muncul di sini."
          />
        ) : (
          shown.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read && markRead(n.id)}
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
    </AppShell>
  );
}

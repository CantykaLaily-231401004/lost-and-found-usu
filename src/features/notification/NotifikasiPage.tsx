import { useState } from "react";
import AppShell from "../../shared/components/AppShell";
import Badge from "../../shared/components/Badge";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import PageBanner from "../../shared/components/PageBanner";
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
  const unreadOf = (t: NotifType) => mine.filter((n) => n.type === t && !n.read).length;
  const shown = tab === "semua" ? mine : mine.filter((n) => n.type === tab);

  return (
    <AppShell wide>
      <PageBanner
        eyebrow="Pusat pesan"
        title="Notifikasi"
        subtitle={unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
        aside={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon name="bell" className="size-6" />
          </span>
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pill"
          label="Jenis notifikasi"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: unread },
            ...TYPES.map((t) => ({ value: t, label: t, count: unreadOf(t) })),
          ]}
        />
        <button
          type="button"
          disabled={unread === 0}
          onClick={() => user && markAllRead(user.id)}
          className="text-sm font-medium text-brand-800 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          Baca semua
        </button>
      </div>

      <div className="mt-4 space-y-3">
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
              className={`flex w-full gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 ${
                n.read
                  ? "border-gray-200"
                  : "border-gray-200 border-l-4 border-l-brand-700"
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-800">
                <Icon name={ICON[n.type]} className="size-5" />
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
                  className={`mt-1 block text-[15px] text-gray-900 ${n.read ? "" : "font-semibold"}`}
                >
                  {n.title}
                </span>
                <span className="mt-0.5 block text-sm leading-6 text-gray-600">
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

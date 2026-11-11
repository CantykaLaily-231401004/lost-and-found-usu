import { useState } from "react";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { formatDateTime } from "../../shared/utils/format";
import AdminShell from "./AdminShell";
import { useAdminStore, type AuditType } from "./adminStore";
import { card, inputCls } from "./adminstyles";
import { PageTitle } from "./adminUI";

const ICON: Record<AuditType, IconName> = {
  Klaim: "clipboard",
  Temuan: "box",
  Jadwal: "calendar",
  Admin: "user",
};

export default function AdminRiwayatPage() {
  const session = useAdminSession();
  const admin = useAdminStore();
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");

  const mine = admin.audit.filter(
    (e) => !session || session.role === "pusat" || e.scope === session.faculty,
  );
  const actors = [...new Set(mine.map((e) => e.actor))];
  const list = mine
    .filter((e) => !actor || e.actor === actor)
    .filter((e) => {
      const t = q.trim().toLowerCase();
      return (
        !t ||
        `${e.actor} ${e.action} ${e.object} ${e.note ?? ""}`
          .toLowerCase()
          .includes(t)
      );
    });

  return (
    <AdminShell>
      <PageTitle
        title="Riwayat Tindakan"
        subtitle="Log audit semua tindakan admin dalam sistem"
      />

      <p className="mt-4 flex items-center gap-2 rounded-xl border border-brand-700/30 bg-brand-50/80 px-3.5 py-2.5 text-[13px] text-brand-950">
        <Icon name="lock" className="size-4 shrink-0" />
        Catatan audit bersifat permanen. Admin tidak dapat mengubah atau
        menghapus riwayat tindakan.
      </p>

      <div className={`${card} mt-3 grid gap-2.5 p-3 sm:grid-cols-[1fr_14rem]`}>
        <input
          className={inputCls}
          placeholder="Cari tindakan, pelaku, atau objek..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={inputCls}
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        >
          <option value="">Semua Pelaku</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        {list.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Belum ada riwayat"
            body="Tindakan admin seperti menyetujui klaim, membuat jadwal, atau mengelola admin akan tercatat di sini."
          />
        ) : (
          <section className={`${card} overflow-hidden`}>
            <p className="border-b border-gray-100 bg-surface px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              {list.length} catatan ditemukan
            </p>
            <ul className="divide-y divide-gray-100">
              {list.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                    <Icon name={ICON[e.type]} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <strong>{e.actor}</strong> {e.action}
                    </p>
                    <p className="text-[13px] text-gray-600">
                      Objek: {e.object}
                    </p>
                    {e.note && (
                      <p className="text-xs text-gray-500">{e.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-500">
                      {formatDateTime(e.at)}
                    </p>
                    <span className="mt-1 inline-block rounded bg-surface px-2 py-0.5 text-[11px] text-gray-600">
                      {e.type}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

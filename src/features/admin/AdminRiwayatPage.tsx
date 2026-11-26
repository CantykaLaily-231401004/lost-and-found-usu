import { useEffect, useState } from "react";
import EmptyState from "../../shared/components/EmptyState";
import Icon, { type IconName } from "../../shared/components/Icon";
import { formatDateTime } from "../../shared/utils/format";
import { listAdminAudit, type AdminAuditItem } from "../../services/admin";
import { errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { card, inputCls } from "./adminStyles";
import { PageTitle } from "./adminUi";

function auditCategory(
  objek: string,
  aksi: string,
): {
  label: string;
  icon: IconName;
} {
  if (
    aksi.includes("pengambilan") ||
    aksi.includes("diterima") ||
    aksi.includes("diserahkan")
  ) {
    return { label: "Pengambilan", icon: "box" };
  }
  if (objek === "claim") return { label: "Klaim", icon: "clipboard" };
  if (objek === "found_report" || objek === "lost_report") {
    return { label: "Temuan", icon: "box" };
  }
  return { label: "Admin", icon: "user" };
}

export default function AdminRiwayatPage() {
  const [items, setItems] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");

  useEffect(() => {
    let active = true;
    listAdminAudit({ page: 1 })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(errorMessage(e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const actors = [
    ...new Set(items.map((e) => e.pelaku.nama).filter(Boolean) as string[]),
  ];
  const list = items
    .filter((e) => !actor || e.pelaku.nama === actor)
    .filter((e) => {
      const t = q.trim().toLowerCase();
      return (
        !t ||
        `${e.pelaku.nama ?? ""} ${e.aksi} ${e.kode ?? ""} ${e.alasan ?? ""}`
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
          placeholder="Cari tindakan, pelaku, atau kode..."
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

      {loadError && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <div className="mt-3">
        {loading ? (
          <p className="text-sm text-gray-500">Memuat riwayat...</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Belum ada riwayat"
            body="Tindakan admin seperti menyetujui klaim, menerima barang, atau mengelola admin akan tercatat di sini."
          />
        ) : (
          <section className={`${card} overflow-hidden`}>
            <p className="border-b border-gray-100 bg-surface px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              {list.length} catatan ditemukan
            </p>
            <ul className="divide-y divide-gray-100">
              {list.map((e) => {
                const cat = auditCategory(e.objek, e.aksi);
                return (
                  <li
                    key={e.audit_id}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                      <Icon name={cat.icon} className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        <strong>{e.pelaku.nama ?? "Sistem"}</strong>{" "}
                        {e.aksi.replace(/_/g, " ")}
                      </p>
                      {e.kode && (
                        <p className="text-[13px] text-gray-600">
                          Objek: {e.kode}
                          {e.nama_area ? ` · ${e.nama_area}` : ""}
                        </p>
                      )}
                      {e.alasan && (
                        <p className="text-xs text-gray-500">{e.alasan}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-500">
                        {formatDateTime(e.waktu)}
                      </p>
                      <span className="mt-1 inline-block rounded bg-surface px-2 py-0.5 text-[11px] text-gray-600">
                        {cat.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

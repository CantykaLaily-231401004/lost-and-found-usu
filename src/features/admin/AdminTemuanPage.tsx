import { Fragment, useState } from "react";
import EmptyState from "../../shared/components/EmptyState";
import {
  ReportKindBadge,
  ReportStatusBadge,
} from "../../shared/components/ReportThumb";
import Tabs from "../../shared/components/Tabs";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { categoryLabel } from "../../shared/store/lofiStore";
import { CATEGORIES } from "../../shared/utils/reportOptions";
import { formatDate, formatDateTime } from "../../shared/utils/format";
import AdminShell from "./AdminShell";
import { useScoped } from "./adminStore";
import { card, inputCls } from "./adminstyles";
import { PageTitle } from "./adminUI";

type Tab = "semua" | "found" | "lost";

export default function AdminTemuanPage() {
  const session = useAdminSession();
  const { reports } = useScoped();
  const [tab, setTab] = useState<Tab>("semua");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const count = (k: "found" | "lost") =>
    reports.filter((r) => r.kind === k).length;
  const list = reports
    .filter((r) => tab === "semua" || r.kind === tab)
    .filter((r) => !cat || r.category === cat)
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return (
        !t ||
        r.description.toLowerCase().includes(t) ||
        r.location.toLowerCase().includes(t)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AdminShell>
      <PageTitle
        title="Temuan dalam Kewenangan"
        subtitle={
          session?.role === "pusat"
            ? "Semua laporan di seluruh kampus"
            : `Laporan di lingkup ${session?.faculty ?? ""}`
        }
      />

      <div className="mt-5">
        <Tabs
          label="Jenis laporan"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: reports.length },
            { value: "found", label: "Temuan", count: count("found") },
            { value: "lost", label: "Kehilangan", count: count("lost") },
          ]}
        />
      </div>

      <div className={`${card} mt-3 grid gap-2.5 p-3 sm:grid-cols-[1fr_14rem]`}>
        <input
          className={inputCls}
          placeholder="Cari deskripsi atau lokasi..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={inputCls}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        {list.length === 0 ? (
          <EmptyState
            icon="box"
            title="Tidak ada laporan"
            body="Belum ada laporan yang sesuai dengan filter dalam lingkup Anda."
          />
        ) : (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">ID</th>
                    <th className="px-2 py-2.5 font-medium">Jenis</th>
                    <th className="px-2 py-2.5 font-medium">Deskripsi</th>
                    <th className="px-2 py-2.5 font-medium">Lokasi</th>
                    <th className="px-2 py-2.5 font-medium">Tanggal</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="align-top">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {r.id}
                        </td>
                        <td className="px-2 py-3">
                          <ReportKindBadge kind={r.kind} />
                        </td>
                        <td className="max-w-[16rem] px-2 py-3">
                          <p className="line-clamp-2 font-medium text-gray-900">
                            {r.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {categoryLabel(r)}
                          </p>
                        </td>
                        <td className="px-2 py-3 text-gray-600">
                          {r.location}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-gray-600">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-2 py-3">
                          <ReportStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenId(openId === r.id ? null : r.id)
                            }
                            className="text-[13px] font-medium text-brand-800 hover:underline"
                          >
                            {openId === r.id ? "Tutup" : "Detail"}
                          </button>
                        </td>
                      </tr>
                      {openId === r.id && (
                        <tr>
                          <td colSpan={7} className="bg-surface/60 px-4 py-3">
                            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                              <div>
                                <dt className="inline text-gray-500">
                                  Area penanganan:{" "}
                                </dt>
                                <dd className="inline text-gray-900">
                                  {r.area}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-gray-500">
                                  Warna / merek:{" "}
                                </dt>
                                <dd className="inline text-gray-900">
                                  {r.color || "-"} / {r.brand || "-"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-gray-500">
                                  Waktu kejadian:{" "}
                                </dt>
                                <dd className="inline text-gray-900">
                                  {formatDate(r.date)}
                                  {r.time ? `, ${r.time}` : ""}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-gray-500">
                                  Dibuat:{" "}
                                </dt>
                                <dd className="inline text-gray-900">
                                  {formatDateTime(r.createdAt)}
                                </dd>
                              </div>
                              {r.kind === "found" && (
                                <div className="sm:col-span-2">
                                  <dt className="inline text-gray-500">
                                    Ciri rahasia:{" "}
                                  </dt>
                                  <dd className="inline text-gray-900">
                                    {r.secrets.length > 0
                                      ? r.secrets.join("; ")
                                      : "-"}
                                  </dd>
                                </div>
                              )}
                              {r.closeReason && (
                                <div className="sm:col-span-2">
                                  <dt className="inline text-gray-500">
                                    Alasan ditutup:{" "}
                                  </dt>
                                  <dd className="inline text-gray-900">
                                    {r.closeReason}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

import { Fragment, useEffect, useState } from "react";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
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
import { reportStatusFromDb } from "../../services/mappers";
import {
  listAdminReports,
  receiveFoundItem,
  type AdminReportItem,
} from "../../services/admin";
import { errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { card, inputCls, smallBtn } from "./adminStyles";
import { PageTitle } from "./adminUi";

type Tab = "semua" | "penemuan" | "kehilangan";

export default function AdminTemuanPage() {
  const session = useAdminSession();
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<Tab>("semua");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [receiving, setReceiving] = useState<AdminReportItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  function reload() {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    listAdminReports()
      .then((res) => {
        if (!active) return;
        setReports(res.items);
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
  }, [reloadKey]);

  const count = (k: "penemuan" | "kehilangan") =>
    reports.filter((r) => r.jenis === k).length;
  const list = reports
    .filter((r) => tab === "semua" || r.jenis === tab)
    .filter((r) => !cat || r.kategori === cat)
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return (
        !t ||
        r.deskripsi.toLowerCase().includes(t) ||
        r.lokasi.toLowerCase().includes(t) ||
        r.kode.toLowerCase().includes(t)
      );
    });

  async function confirmReceive() {
    if (!receiving || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await receiveFoundItem(receiving.id);
      setReceiving(null);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

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
            { value: "penemuan", label: "Temuan", count: count("penemuan") },
            {
              value: "kehilangan",
              label: "Kehilangan",
              count: count("kehilangan"),
            },
          ]}
        />
      </div>

      <div className={`${card} mt-3 grid gap-2.5 p-3 sm:grid-cols-[1fr_14rem]`}>
        <input
          className={inputCls}
          placeholder="Cari kode, deskripsi, atau lokasi..."
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

      {loadError && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}{" "}
          <button
            type="button"
            onClick={reload}
            className="font-medium underline"
          >
            Coba lagi
          </button>
        </p>
      )}

      <div className="mt-3">
        {loading ? (
          <p className="text-sm text-gray-500">Memuat laporan...</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon="box"
            title="Tidak ada laporan"
            body="Belum ada laporan yang sesuai dengan filter dalam lingkup Anda."
          />
        ) : (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Kode</th>
                    <th className="px-2 py-2.5 font-medium">Jenis</th>
                    <th className="px-2 py-2.5 font-medium">Deskripsi</th>
                    <th className="px-2 py-2.5 font-medium">Lokasi</th>
                    <th className="px-2 py-2.5 font-medium">Tanggal</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((r) => {
                    const kind = r.jenis === "penemuan" ? "found" : "lost";
                    const statusLabel = reportStatusFromDb(r.status);
                    return (
                      <Fragment key={`${r.jenis}-${r.id}`}>
                        <tr className="align-top">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                            {r.kode}
                          </td>
                          <td className="px-2 py-3">
                            <ReportKindBadge kind={kind} />
                          </td>
                          <td className="max-w-[16rem] px-2 py-3">
                            <p className="line-clamp-2 font-medium text-gray-900">
                              {r.deskripsi}
                            </p>
                            <p className="text-xs text-gray-500">
                              {categoryLabel({
                                category: r.kategori,
                                categoryOther: r.kategori_lainnya ?? "",
                              })}
                            </p>
                          </td>
                          <td className="px-2 py-3 text-gray-600">
                            {r.lokasi}
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-gray-600">
                            {formatDate(r.tanggal)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-3">
                            <ReportStatusBadge status={statusLabel} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {r.jenis === "penemuan" &&
                                r.status === "menunggu" && (
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setReceiving(r);
                                      setActionError("");
                                    }}
                                    className={`${smallBtn} shrink-0 whitespace-nowrap`}
                                  >
                                    Terima barang
                                  </Button>
                                )}
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenId(openId === r.id ? null : r.id)
                                }
                                className="text-[13px] font-medium text-brand-800 hover:underline"
                              >
                                {openId === r.id ? "Tutup" : "Detail"}
                              </button>
                            </div>
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
                                    {r.nama_area}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-gray-500">
                                    Warna / merek:{" "}
                                  </dt>
                                  <dd className="inline text-gray-900">
                                    {r.warna || "-"} / {r.merek || "-"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-gray-500">
                                    Waktu kejadian:{" "}
                                  </dt>
                                  <dd className="inline text-gray-900">
                                    {formatDate(r.tanggal)}
                                    {r.jam ? `, ${r.jam.slice(0, 5)} WIB` : ""}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-gray-500">
                                    Dibuat:{" "}
                                  </dt>
                                  <dd className="inline text-gray-900">
                                    {formatDateTime(r.created_at)}
                                  </dd>
                                </div>
                                {r.jenis === "penemuan" && (
                                  <div className="sm:col-span-2">
                                    <dt className="inline text-gray-500">
                                      Ciri rahasia:{" "}
                                    </dt>
                                    <dd className="inline text-gray-900">
                                      {r.ciri_rahasia.length > 0
                                        ? r.ciri_rahasia.join("; ")
                                        : "-"}
                                    </dd>
                                  </div>
                                )}
                              </dl>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {receiving && (
        <ConfirmDialog
          title="Terima barang dari penemu?"
          confirmLabel={busy ? "Memproses..." : "Terima Barang"}
          onConfirm={() => void confirmReceive()}
          onCancel={() => !busy && setReceiving(null)}
        >
          <p>
            Pastikan barang fisik sudah Anda terima dan sesuai laporan{" "}
            <strong>{receiving.kode}</strong>. Setelah diterima, laporan tampil
            di katalog dan bisa diklaim.
          </p>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

import { useEffect, useState } from "react";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import TextField from "../../shared/components/TextField";
import { categoryLabel } from "../../shared/store/lofiStore";
import { formatDateTime, shorten } from "../../shared/utils/format";
import {
  DEFAULT_WORKING_HOURS,
  HANDOVER_DEADLINE_DAYS,
  isPastDeadline,
} from "../../shared/utils/handover";
import {
  cancelClaimAdminRpc,
  completePickupRpc,
  listAdminClaims,
  listAdminReports,
  receiveFoundItem,
  type AdminClaimItem,
  type AdminReportItem,
} from "../../services/admin";
import { errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { card, smallBtn } from "./adminStyles";
import { PageTitle } from "./adminUi";

type Tab = "menunggu" | "siap" | "riwayat";
type Dialog =
  | { kind: "receive"; r: AdminReportItem }
  | { kind: "pickup"; c: AdminClaimItem }
  | { kind: "expire"; c: AdminClaimItem };

export default function AdminPengambilanPage() {
  const [tab, setTab] = useState<Tab>("menunggu");
  const [waiting, setWaiting] = useState<AdminReportItem[]>([]);
  const [claims, setClaims] = useState<AdminClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [code, setCode] = useState("");
  const [ktmOk, setKtmOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reload() {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      listAdminReports({ jenis: "penemuan", status: "menunggu" }),
      listAdminClaims(),
    ])
      .then(([repRes, claimRes]) => {
        if (!active) return;
        setWaiting(
          [...repRes.items].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        );
        setClaims(claimRes.items);
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

  const ready = claims
    .filter((c) => c.status === "disetujui")
    .sort((a, b) =>
      (a.batas_ambil_at ?? "").localeCompare(b.batas_ambil_at ?? ""),
    );
  const history = claims
    .filter((c) => c.status === "selesai")
    .sort((a, b) =>
      (b.diserahkan_at ?? b.tanggal_pengajuan).localeCompare(
        a.diserahkan_at ?? a.tanggal_pengajuan,
      ),
    );

  function open(d: Dialog) {
    setDialog(d);
    setCode("");
    setKtmOk(false);
    setError("");
  }

  async function confirm() {
    if (!dialog || busy) return;
    if (dialog.kind === "pickup") {
      if (!ktmOk) {
        return setError(
          "Centang bahwa KTM sudah diperiksa dan sesuai dengan akun pemilik.",
        );
      }
      if (!/^\d{6}$/.test(code.trim())) {
        return setError("Kode pengambilan terdiri dari 6 angka.");
      }
    }

    setBusy(true);
    setError("");
    try {
      if (dialog.kind === "receive") {
        await receiveFoundItem(dialog.r.id);
      } else if (dialog.kind === "pickup") {
        await completePickupRpc(dialog.c.claim_id, code.trim());
      } else {
        await cancelClaimAdminRpc(
          dialog.c.claim_id,
          "Batas pengambilan sudah terlewat.",
        );
      }
      setDialog(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <PageTitle
        title="Penerimaan dan Pengambilan"
        subtitle="Terima barang dari penemu, lalu serahkan ke pemilik setelah KTM dan kode diperiksa"
      />
      <p className="mt-2 text-[13px] text-gray-500">
        Jam kerja: {DEFAULT_WORKING_HOURS}. Penemu menyerahkan barang paling
        lambat {HANDOVER_DEADLINE_DAYS} hari kerja setelah melapor.
      </p>

      <div className="mt-5">
        <Tabs
          label="Tahap penanganan barang"
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "menunggu",
              label: "Menunggu penyerahan",
              count: waiting.length,
            },
            { value: "siap", label: "Siap diambil", count: ready.length },
            { value: "riwayat", label: "Riwayat", count: history.length },
          ]}
        />
      </div>

      {loadError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
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

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {loading ? (
          <p className="text-sm text-gray-500 xl:col-span-2">Memuat data...</p>
        ) : (
          <>
            {tab === "menunggu" &&
              (waiting.length === 0 ? (
                <div className="xl:col-span-2">
                  <EmptyState
                    icon="box"
                    title="Tidak ada barang menunggu"
                    body="Laporan temuan yang barangnya belum diserahkan penemu akan tampil di sini."
                  />
                </div>
              ) : (
                waiting.map((r) => (
                  <article key={r.id} className={`${card} p-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="amber">Menunggu Penyerahan</Badge>
                        <span className="font-mono text-xs text-gray-500">
                          {r.kode}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => open({ kind: "receive", r })}
                        className={smallBtn}
                      >
                        Terima barang
                      </Button>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">
                      {shorten(r.deskripsi, 70)}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {categoryLabel({
                        category: r.kategori,
                        categoryOther: r.kategori_lainnya ?? "",
                      })}{" "}
                      · {r.lokasi}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Dilaporkan {formatDateTime(r.created_at)}
                    </p>
                  </article>
                ))
              ))}

            {tab === "siap" &&
              (ready.length === 0 ? (
                <div className="xl:col-span-2">
                  <EmptyState
                    icon="clipboard"
                    title="Belum ada barang siap diambil"
                    body="Klaim yang sudah disetujui dan menunggu pemilik datang akan tampil di sini."
                  />
                </div>
              ) : (
                ready.map((c) => {
                  const late = isPastDeadline(c.batas_ambil_at ?? undefined);
                  return (
                    <article
                      key={c.claim_id}
                      className={`${card} p-4 ${late ? "opacity-90" : "border-2 border-brand-700"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={late ? "redSoft" : "soft"}>
                            {late ? "Lewat batas ambil" : "Siap diambil"}
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">
                            {c.temuan.kode}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {late && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={c.konflik}
                              onClick={() => open({ kind: "expire", c })}
                              className={smallBtn}
                            >
                              Batalkan klaim
                            </Button>
                          )}
                          <Button
                            type="button"
                            disabled={c.konflik}
                            onClick={() => open({ kind: "pickup", c })}
                            className={smallBtn}
                          >
                            Selesaikan
                          </Button>
                        </div>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">
                        {shorten(c.temuan.deskripsi, 70)}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Pemohon: <strong>{c.pemohon.nama}</strong> (
                        {c.pemohon.email})
                      </p>
                      {c.batas_ambil_at && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                          <Icon name="clock" className="size-3.5" />
                          Batas ambil: {formatDateTime(c.batas_ambil_at)}
                        </p>
                      )}
                      {c.konflik && (
                        <p className="mt-2 text-xs text-amber-700">
                          Anda terkait dengan laporan/klaim ini sehingga tidak
                          dapat memproses pengambilan.
                        </p>
                      )}
                    </article>
                  );
                })
              ))}

            {tab === "riwayat" &&
              (history.length === 0 ? (
                <div className="xl:col-span-2">
                  <EmptyState
                    icon="clock"
                    title="Belum ada pengambilan selesai"
                    body="Barang yang sudah diserahkan kepada pemiliknya tampil di sini."
                  />
                </div>
              ) : (
                history.map((c) => (
                  <article
                    key={c.claim_id}
                    className={`${card} p-4 opacity-80`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="green">Selesai</Badge>
                      <span className="font-mono text-xs text-gray-500">
                        {c.temuan.kode}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">
                      {shorten(c.temuan.deskripsi, 70)}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Diambil oleh: {c.pemohon.nama}
                    </p>
                    {c.diserahkan_at && (
                      <p className="mt-1 text-xs text-gray-500">
                        Diserahkan: {formatDateTime(c.diserahkan_at)}
                      </p>
                    )}
                  </article>
                ))
              ))}
          </>
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          title={
            dialog.kind === "receive"
              ? "Terima barang dari penemu?"
              : dialog.kind === "pickup"
                ? "Selesaikan pengambilan?"
                : "Batalkan klaim?"
          }
          confirmLabel={
            busy
              ? "Memproses..."
              : dialog.kind === "receive"
                ? "Terima Barang"
                : dialog.kind === "pickup"
                  ? "Selesaikan"
                  : "Batalkan Klaim"
          }
          danger={dialog.kind === "expire"}
          onConfirm={() => void confirm()}
          onCancel={() => !busy && setDialog(null)}
        >
          {dialog.kind === "receive" && (
            <>
              <p>
                Pastikan barang fisik sudah Anda terima dan sesuai laporan{" "}
                <strong>{dialog.r.kode}</strong>. Setelah diterima, laporan
                tampil di katalog dan bisa diklaim.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}

          {dialog.kind === "pickup" && (
            <>
              <p>
                Periksa KTM pemilik atas nama{" "}
                <strong>{dialog.c.pemohon.nama}</strong>, lalu masukkan 6 digit
                kode pengambilan yang ditunjukkan pemilik.
              </p>
              <TextField
                label="Kode pengambilan (6 angka)"
                inputMode="numeric"
                maxLength={6}
                placeholder="Contoh: 123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                error={
                  error && !error.startsWith("Centang") ? error : undefined
                }
              />
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#2d7a4e]"
                  checked={ktmOk}
                  onChange={(e) => {
                    setKtmOk(e.target.checked);
                    setError("");
                  }}
                />
                KTM sudah diperiksa dan sesuai dengan akun pemilik
              </label>
              {error.startsWith("Centang") && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </>
          )}

          {dialog.kind === "expire" && (
            <>
              <p>
                Batas pengambilan sudah lewat. Klaim untuk barang{" "}
                <strong>{dialog.c.temuan.kode}</strong> akan dibatalkan dan
                barang kembali Tersedia di katalog.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

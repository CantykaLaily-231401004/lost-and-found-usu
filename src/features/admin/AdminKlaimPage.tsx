import { useEffect, useState } from "react";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import TextField from "../../shared/components/TextField";
import { categoryLabel } from "../../shared/store/lofiStore";
import { formatDateTime } from "../../shared/utils/format";
import { claimStatusFromDb } from "../../services/mappers";
import {
  approveClaimRpc,
  listAdminClaims,
  rejectClaimRpc,
  type AdminClaimItem,
} from "../../services/admin";
import { errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { CLAIM_TONE, card, smallBtn } from "./adminStyles";
import { PageTitle } from "./adminUi";

type Tab = "Menunggu" | "Disetujui" | "Ditolak" | "semua";

export default function AdminKlaimPage() {
  const [claims, setClaims] = useState<AdminClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<Tab>("Menunggu");
  const [matched, setMatched] = useState<Record<string, number[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<AdminClaimItem | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function reload() {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    listAdminClaims()
      .then((res) => {
        if (!active) return;
        setClaims(res.items);
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

  const inTab = (c: AdminClaimItem, t: Tab) => {
    const s = claimStatusFromDb(c.status);
    return t === "semua"
      ? true
      : t === "Disetujui"
        ? s === "Disetujui" || s === "Selesai"
        : s === t;
  };
  const count = (t: Tab) => claims.filter((c) => inTab(c, t)).length;
  const shown = claims.filter((c) => inTab(c, tab));

  function toggleMatch(id: string, num: number) {
    setMatched((m) => {
      const cur = m[id] ?? [];
      return {
        ...m,
        [id]: cur.includes(num) ? cur.filter((x) => x !== num) : [...cur, num],
      };
    });
  }

  async function handleApprove(c: AdminClaimItem, sel: number[]) {
    if (busyId || sel.length < 1) return;
    setBusyId(c.claim_id);
    setLoadError("");
    try {
      await approveClaimRpc(
        c.claim_id,
        sel,
        "Bukti kepemilikan sesuai ciri rahasia.",
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting || busyId) return;
    if (reason.trim().length < 3) {
      return setError("Tulis alasan penolakan (minimal 3 karakter).");
    }
    setBusyId(rejecting.claim_id);
    setError("");
    try {
      await rejectClaimRpc(rejecting.claim_id, reason.trim());
      setRejecting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell>
      <PageTitle
        title="Verifikasi Klaim"
        subtitle="Periksa dan putuskan klaim kepemilikan barang temuan"
      />

      <div className="mt-5">
        <Tabs
          label="Status klaim"
          value={tab}
          onChange={setTab}
          items={[
            { value: "Menunggu", label: "Menunggu", count: count("Menunggu") },
            {
              value: "Disetujui",
              label: "Disetujui",
              count: count("Disetujui"),
            },
            { value: "Ditolak", label: "Ditolak", count: count("Ditolak") },
            { value: "semua", label: "Semua", count: count("semua") },
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
          <p className="text-sm text-gray-500 xl:col-span-2">Memuat klaim...</p>
        ) : shown.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="clipboard"
              title="Tidak ada klaim"
              body="Klaim dari pengguna untuk barang dalam lingkup Anda akan muncul di sini."
            />
          </div>
        ) : (
          shown.map((c) => {
            const statusLabel = claimStatusFromDb(c.status);
            const secrets = c.ciri_rahasia ?? [];
            const sel = matched[c.claim_id] ?? [];
            const pending = c.status === "menunggu";
            const open = !!expanded[c.claim_id];
            const isBusy = busyId === c.claim_id;

            return (
              <article
                key={c.claim_id}
                className={`${card} p-4 ${pending ? "" : "opacity-80"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CLAIM_TONE[statusLabel]}>{statusLabel}</Badge>
                    <span className="font-mono text-xs text-gray-500">
                      {c.temuan.kode}
                    </span>
                  </div>
                  {pending && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={c.konflik || isBusy}
                        onClick={() => {
                          setRejecting(c);
                          setReason("");
                          setError("");
                        }}
                        className={smallBtn}
                      >
                        Tolak
                      </Button>
                      <Button
                        type="button"
                        disabled={c.konflik || isBusy || sel.length < 1}
                        onClick={() => void handleApprove(c, sel)}
                        className={smallBtn}
                      >
                        {isBusy ? "Memproses..." : "Setujui"}
                      </Button>
                    </div>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-semibold leading-5 text-gray-900">
                  {c.temuan.deskripsi}
                </h3>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  {categoryLabel({
                    category: c.temuan.kategori,
                    categoryOther: c.temuan.kategori_lainnya ?? "",
                  })}{" "}
                  · {c.temuan.lokasi}
                </p>
                <p className="text-[13px] text-gray-500">
                  Pemohon: {c.pemohon.nama} · Diajukan:{" "}
                  {formatDateTime(c.tanggal_pengajuan)}
                </p>

                {c.konflik && pending && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Anda terkait dengan laporan/klaim ini sehingga tidak dapat
                    memutuskannya.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [c.claim_id]: !open }))
                  }
                  className="mt-2 text-[13px] font-medium text-brand-800 hover:underline"
                >
                  {open ? "▾" : "▸"} Lihat detail klaim & ciri rahasia
                </button>
                {pending && !open && sel.length < 1 && !c.konflik && (
                  <p className="mt-1 text-xs text-gray-500">
                    Buka detail dan centang ciri yang cocok untuk bisa
                    menyetujui.
                  </p>
                )}

                {open && (
                  <div className="mt-3 space-y-2.5">
                    <div className="rounded-lg bg-surface px-3.5 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Bukti pengklaim
                      </p>
                      <p className="mt-1 text-sm leading-6 text-gray-800">
                        {c.bukti}
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-700/30 bg-brand-50/80 px-3.5 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-800">
                        <Icon name="lock" className="size-3.5" /> Ciri rahasia
                        penemu
                      </p>
                      {secrets.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-600">
                          Tidak ada ciri tercatat.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1.5">
                          {secrets.map((s, i) => {
                            const num = i + 1;
                            const checked = pending
                              ? sel.includes(num)
                              : (c.ciri_cocok ?? []).includes(num);
                            return (
                              <li key={s + i}>
                                <label
                                  className={`flex items-start gap-2 text-sm text-gray-800 ${pending && !c.konflik ? "cursor-pointer" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 size-4 accent-[#2d7a4e]"
                                    checked={checked}
                                    disabled={!pending || c.konflik}
                                    onChange={() =>
                                      toggleMatch(c.claim_id, num)
                                    }
                                  />
                                  <span>{s}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {pending && (
                        <p className="mt-2 text-xs text-gray-500">
                          Centang ciri yang cocok dengan bukti. Minimal satu.
                        </p>
                      )}
                    </div>
                    {c.alasan && (
                      <p className="text-sm text-gray-600">
                        <strong>Catatan:</strong> {c.alasan}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {rejecting && (
        <ConfirmDialog
          title="Tolak klaim?"
          confirmLabel={busyId ? "Memproses..." : "Tolak Klaim"}
          danger
          onConfirm={() => void confirmReject()}
          onCancel={() => !busyId && setRejecting(null)}
        >
          <p>
            Klaim untuk barang <strong>{rejecting.temuan.kode}</strong> akan
            ditolak dan pengklaim diberi tahu.
          </p>
          <TextField
            label="Alasan penolakan"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            error={error}
          />
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

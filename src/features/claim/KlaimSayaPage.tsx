import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Badge, { type BadgeTone } from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import TextArea from "../../shared/components/TextArea";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import { categoryLabel, type ClaimStatus } from "../../shared/store/lofiStore";
import { formatDateTime, shorten } from "../../shared/utils/format";
import { DEFAULT_WORKING_HOURS } from "../../shared/utils/handover";
import { handoverPointLabel, type MyClaim } from "../../services/mappers";
import { errorMessage } from "../../services/rpc";
import {
  cancelClaim,
  listMyClaims,
  MAX_CANCEL_REASON,
  MIN_CANCEL_REASON,
} from "../../services/claims";

type Tab = "semua" | "Menunggu" | "Disetujui" | "Ditolak";

const TONE: Record<ClaimStatus, BadgeTone> = {
  Menunggu: "amber",
  Disetujui: "green",
  Ditolak: "redSoft",
  Dibatalkan: "graySoft",
  Selesai: "soft",
};

type Loaded = { key: string; claims: MyClaim[]; error: string };

export default function KlaimSayaPage() {
  const { user } = useSessionUser();
  const userId = user?.id;
  const [tab, setTab] = useState<Tab>("semua");
  const [cancelling, setCancelling] = useState<MyClaim | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const requestKey = `${userId}|${reloadKey}`;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyClaims(userId)
      .then(
        (claims) => active && setLoaded({ key: requestKey, claims, error: "" }),
      )
      .catch(
        (e) =>
          active &&
          setLoaded({ key: requestKey, claims: [], error: errorMessage(e) }),
      );
    return () => {
      active = false;
    };
  }, [userId, requestKey]);

  const loading = !loaded || loaded.key !== requestKey;
  const mine = loaded?.claims ?? [];
  const by = (s: ClaimStatus) => mine.filter((c) => c.status === s).length;
  const shown = tab === "semua" ? mine : mine.filter((c) => c.status === tab);

  function openCancel(c: MyClaim) {
    setCancelling(c);
    setReason("");
    setReasonError("");
  }

  async function confirmCancel() {
    if (!cancelling || cancelBusy) return;
    const text = reason.trim();
    if (text.length < MIN_CANCEL_REASON)
      return setReasonError(
        `Tulis alasan pembatalan (minimal ${MIN_CANCEL_REASON} karakter).`,
      );
    setCancelBusy(true);
    try {
      await cancelClaim(cancelling.id, text);
      setCancelling(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setReasonError(errorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
            Klaim Saya
          </h1>
          <p className="mt-1 text-[15px] text-gray-600">
            Daftar pengajuan klaim barang temuan
          </p>
        </div>
        <Link to="/cari">
          <Button
            type="button"
            className="h-9! w-auto! px-4! text-[13px]! sm:px-5!"
          >
            <Icon name="plus" className="size-4" /> Klaim Baru
          </Button>
        </Link>
      </div>

      <div className="mt-5">
        <Tabs
          label="Status klaim"
          value={tab}
          onChange={setTab}
          items={[
            { value: "semua", label: "Semua", count: mine.length },
            { value: "Menunggu", label: "Menunggu", count: by("Menunggu") },
            { value: "Disetujui", label: "Disetujui", count: by("Disetujui") },
            { value: "Ditolak", label: "Ditolak", count: by("Ditolak") },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {loading ? (
          <p className="text-sm text-gray-500 xl:col-span-2">Memuat klaim...</p>
        ) : loaded.error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 xl:col-span-2">
            {loaded.error}{" "}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="font-medium underline"
            >
              Coba lagi
            </button>
          </p>
        ) : shown.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="clipboard"
              title="Belum ada klaim"
              body="Temukan barang Anda di Cari Barang, lalu ajukan klaim dengan bukti kepemilikan."
              action={
                <Link to="/cari">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9! w-auto! px-4! text-[13px]!"
                  >
                    Cari Barang
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          shown.map((c) => {
            const item = c.item;
            return (
              <article
                key={c.id}
                className={`rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm transition hover:shadow-md ${
                  c.status === "Ditolak" || c.status === "Dibatalkan"
                    ? "opacity-75"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[c.status]}>{c.status}</Badge>
                    {item && (
                      <Link
                        to={`/cari/${item.kode}`}
                        className="font-mono text-xs text-gray-500 hover:text-brand-800 hover:underline"
                      >
                        {item.kode}
                      </Link>
                    )}
                  </div>
                  {c.status === "Menunggu" && (
                    <button
                      type="button"
                      onClick={() => openCancel(c)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
                <h2 className="mt-2 text-sm font-semibold leading-5 text-gray-900">
                  {item
                    ? `${shorten(item.description, 70)} — ${item.location}`
                    : "Barang tidak tersedia"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {item && `${categoryLabel(item)} · `}Diajukan:{" "}
                  {formatDateTime(c.createdAt)}
                </p>
                <div className="mt-3 rounded-lg bg-surface px-3.5 py-2.5">
                  <p className="text-sm font-medium text-gray-900">
                    Bukti yang diajukan:
                  </p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">
                    {c.evidence}
                  </p>
                </div>
                {(c.status === "Ditolak" || c.status === "Dibatalkan") &&
                  c.reason && (
                    <p className="mt-2 text-sm text-gray-600">
                      <strong>
                        {c.status === "Ditolak"
                          ? "Alasan penolakan"
                          : "Alasan pembatalan"}
                        :
                      </strong>{" "}
                      {c.reason}
                      {c.decidedAt && (
                        <span className="text-gray-500">
                          {" "}
                          ({formatDateTime(c.decidedAt)})
                        </span>
                      )}
                    </p>
                  )}
                {c.status === "Disetujui" && (
                  <div className="mt-3 rounded-lg border border-brand-700/30 bg-brand-50 px-3.5 py-3 text-sm text-brand-950">
                    <p className="font-medium">
                      Klaim disetujui. Ambil barang di{" "}
                      {handoverPointLabel(item?.areaName, item?.areaKind)}.
                    </p>
                    {c.pickupCode ? (
                      <p className="mt-2">
                        Kode pengambilan:{" "}
                        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-base font-bold tracking-widest">
                          {c.pickupCode}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-brand-800">
                        Kode pengambilan sedang disiapkan.
                      </p>
                    )}
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">
                      <li>Bawa KTM dan tunjukkan kode ini kepada admin.</li>
                      <li>Datang pada jam kerja: {DEFAULT_WORKING_HOURS}.</li>
                      {c.pickupDeadline && (
                        <li>
                          Batas pengambilan: {formatDateTime(c.pickupDeadline)}.
                          Lewat batas, klaim dibatalkan dan barang kembali
                          tersedia.
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {cancelling && (
        <ConfirmDialog
          title="Batalkan klaim?"
          confirmLabel={cancelBusy ? "Membatalkan..." : "Batalkan Klaim"}
          danger
          onConfirm={() => void confirmCancel()}
          onCancel={() => setCancelling(null)}
        >
          <p>
            Klaim untuk barang {cancelling.item?.kode ?? "ini"} akan dibatalkan.
            Anda masih bisa mengajukan klaim baru untuk barang yang sama selama
            masih tersedia.
          </p>
          <TextArea
            label="Alasan pembatalan"
            rows={3}
            maxLength={MAX_CANCEL_REASON}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError("");
            }}
            error={reasonError}
          />
        </ConfirmDialog>
      )}
    </AppShell>
  );
}

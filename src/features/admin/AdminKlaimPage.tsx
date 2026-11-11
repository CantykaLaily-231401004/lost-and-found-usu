import { useState } from "react";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Tabs from "../../shared/components/Tabs";
import TextField from "../../shared/components/TextField";
import { categoryLabel, type Claim } from "../../shared/store/lofiStore";
import { formatDateTime } from "../../shared/utils/format";
import AdminShell from "./AdminShell";
import { actApprove, actReject, useAdminActor, useScoped } from "./adminStore";
import { CLAIM_TONE, card, smallBtn } from "./adminstyles";
import { PageTitle } from "./adminUI";

type Tab = "Menunggu" | "Disetujui" | "Ditolak" | "semua";

export default function AdminKlaimPage() {
  const actor = useAdminActor();
  const { reports, claims } = useScoped();
  const [tab, setTab] = useState<Tab>("Menunggu");
  const [matched, setMatched] = useState<Record<string, number[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const sorted = [...claims].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const inTab = (c: Claim, t: Tab) =>
    t === "semua"
      ? true
      : t === "Disetujui"
        ? c.status === "Disetujui" || c.status === "Selesai"
        : c.status === t;
  const count = (t: Tab) => sorted.filter((c) => inTab(c, t)).length;
  const shown = sorted.filter((c) => inTab(c, tab));

  function toggleMatch(id: string, i: number) {
    setMatched((m) => {
      const cur = m[id] ?? [];
      return {
        ...m,
        [id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i],
      };
    });
  }

  function confirmReject() {
    if (!rejecting || !actor) return;
    const r = reports.find((x) => x.id === rejecting.reportId);
    if (!actReject(actor, rejecting, r, reason))
      return setError("Tulis alasan penolakan (minimal 3 karakter).");
    setRejecting(null);
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

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {shown.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="clipboard"
              title="Tidak ada klaim"
              body="Klaim dari pengguna untuk barang dalam lingkup Anda akan muncul di sini."
            />
          </div>
        ) : (
          shown.map((c) => {
            const r = reports.find((x) => x.id === c.reportId);
            const secrets = r?.secrets ?? [];
            const sel = matched[c.id] ?? [];
            const pending = c.status === "Menunggu";
            const open = !!expanded[c.id];
            return (
              <article
                key={c.id}
                className={`${card} p-4 ${pending ? "" : "opacity-80"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CLAIM_TONE[c.status]}>{c.status}</Badge>
                    <span className="font-mono text-xs text-gray-500">
                      {c.id}
                    </span>
                  </div>
                  {pending && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
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
                        disabled={sel.length < 1}
                        onClick={() => actor && actApprove(actor, c, r, sel)}
                        className={smallBtn}
                      >
                        Setujui
                      </Button>
                    </div>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-semibold leading-5 text-gray-900">
                  {r ? r.description : c.reportId}
                </h3>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  {r ? `${r.id} · ${categoryLabel(r)} · ${r.location}` : ""}
                </p>
                <p className="text-[13px] text-gray-500">
                  Diajukan: {formatDateTime(c.createdAt)}
                </p>

                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))}
                  className="mt-2 text-[13px] font-medium text-brand-800 hover:underline"
                >
                  {open ? "▾" : "▸"} Lihat detail klaim & ciri rahasia
                </button>
                {pending && !open && sel.length < 1 && (
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
                        {c.evidence}
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
                            const checked = pending
                              ? sel.includes(i)
                              : (c.matchedSecrets ?? []).includes(i);
                            return (
                              <li key={s + i}>
                                <label
                                  className={`flex items-start gap-2 text-sm text-gray-800 ${pending ? "cursor-pointer" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 size-4 accent-[#2d7a4e]"
                                    checked={checked}
                                    disabled={!pending}
                                    onChange={() => toggleMatch(c.id, i)}
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
                    {c.decisionReason && (
                      <p className="text-sm text-gray-600">
                        <strong>Alasan penolakan:</strong> {c.decisionReason}
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
          confirmLabel="Tolak Klaim"
          danger
          onConfirm={confirmReject}
          onCancel={() => setRejecting(null)}
        >
          <p>Klaim {rejecting.id} akan ditolak dan pengklaim diberi tahu.</p>
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

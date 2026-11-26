import { useEffect, useState } from "react";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Select from "../../shared/components/Select";
import TextField from "../../shared/components/TextField";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { fetchAreas, type Area } from "../../services/areas";
import {
  assignFacultyAdmin,
  listAdminAccounts,
  revokeFacultyAdmin,
  type AdminAccountItem,
} from "../../services/admin";
import { ServiceError, errorMessage } from "../../services/rpc";
import AdminShell from "./AdminShell";
import { card } from "./adminStyles";
import { PageTitle } from "./adminUi";

type RevokeTarget = {
  assignmentId: string;
  adminName: string;
  areaName: string;
};

function isFacultyArea(a: Area): boolean {
  const extra = a as Area & { kind?: string; jenis_area?: string };
  if (extra.kind) return extra.kind === "fakultas";
  if (extra.jenis_area) return extra.jenis_area === "fakultas";
  return !/umum/i.test(a.name);
}

export default function AdminPengelolaanPage() {
  const session = useAdminSession();
  const isPusat = session?.role === "pusat";

  const [admins, setAdmins] = useState<AdminAccountItem[]>([]);
  const [faculties, setFaculties] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [areaId, setAreaId] = useState("");
  const [emailError, setEmailError] = useState("");
  const [areaError, setAreaError] = useState("");
  const [addError, setAddError] = useState("");

  const [removing, setRemoving] = useState<RevokeTarget | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const [busy, setBusy] = useState(false);

  function reload() {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    if (!isPusat) return;
    let active = true;
    Promise.all([listAdminAccounts(), fetchAreas()])
      .then(([accRes, areaList]) => {
        if (!active) return;
        setAdmins(accRes.items);
        setFaculties(areaList.filter(isFacultyArea));
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
  }, [isPusat, reloadKey]);

  if (session && !isPusat) {
    return (
      <AdminShell>
        <EmptyState
          icon="lock"
          title="Khusus Admin Pusat"
          body="Penugasan dan pencabutan admin fakultas hanya dapat dilakukan oleh Admin Pusat."
        />
      </AdminShell>
    );
  }

  function openAdd() {
    setAdding(true);
    setEmail("");
    setAreaId("");
    setEmailError("");
    setAreaError("");
    setAddError("");
  }

  async function confirmAdd() {
    if (busy) return;
    const cleanEmail = email.trim();
    let invalid = false;
    if (!cleanEmail) {
      setEmailError("Surel akun wajib diisi.");
      invalid = true;
    }
    if (!areaId) {
      setAreaError("Pilih fakultas cakupan.");
      invalid = true;
    }
    if (invalid) return;

    setBusy(true);
    setEmailError("");
    setAreaError("");
    setAddError("");
    try {
      const res = await assignFacultyAdmin(cleanEmail, areaId);
      setAdding(false);
      setNotice(
        res.duplikat
          ? `${res.nama} sudah aktif sebagai Admin Fakultas ${res.nama_area}.`
          : `${res.nama} ditetapkan sebagai Admin Fakultas ${res.nama_area}.`,
      );
      reload();
    } catch (e) {
      const msg = errorMessage(e);
      const field = e instanceof ServiceError ? e.field : undefined;
      if (field === "email") setEmailError(msg);
      else if (field === "area_id") setAreaError(msg);
      else setAddError(msg);
    } finally {
      setBusy(false);
    }
  }

  function openRevoke(target: RevokeTarget) {
    setRemoving(target);
    setReason("");
    setReasonError("");
  }

  async function confirmRevoke() {
    if (!removing || busy) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      setReasonError("Alasan pencabutan wajib diisi (minimal 3 karakter).");
      return;
    }

    setBusy(true);
    setReasonError("");
    try {
      await revokeFacultyAdmin(removing.assignmentId, cleanReason);
      setNotice(
        `Akses Admin Fakultas ${removing.areaName} untuk ${removing.adminName} telah dicabut.`,
      );
      setRemoving(null);
      reload();
    } catch (e) {
      setReasonError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <PageTitle
        title="Pengelolaan Admin"
        subtitle="Tambah dan kelola akun admin fakultas. Hanya Admin Pusat."
        action={
          <Button
            type="button"
            onClick={openAdd}
            className="h-9! w-auto! whitespace-nowrap px-4! text-[13px]! sm:px-5!"
          >
            <Icon name="plus" className="size-4" /> Tambah Admin Fakultas
          </Button>
        }
      />

      <p className="mt-4 rounded-xl border border-tag/50 bg-tag/15 px-3.5 py-2.5 text-[13px] text-brand-950">
        Penugasan admin fakultas hanya dapat dilakukan oleh Admin Pusat. Admin
        fakultas hanya menangani data sesuai kewenangannya masing-masing.
      </p>

      {notice && (
        <p className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-brand-700/30 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-950">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-xs font-medium text-brand-800 hover:underline"
          >
            Tutup
          </button>
        </p>
      )}

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

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {loading ? (
          <p className="text-sm text-gray-500 xl:col-span-2">
            Memuat daftar admin...
          </p>
        ) : admins.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon="user"
              title="Belum ada akun admin"
              body="Daftar admin pusat dan admin fakultas akan tampil di sini."
            />
          </div>
        ) : (
          admins.map((a) => {
            const activeAreas = a.penugasan.filter((p) => p.status === "aktif");
            const isAdminPusat = a.role === "admin_pusat";
            return (
              <article key={a.user_id} className={`${card} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-800 font-display text-lg font-bold text-white">
                    {(a.nama || a.email)[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {a.nama}
                      </p>
                      <Badge tone={isAdminPusat ? "green" : "soft"}>
                        {isAdminPusat ? "Admin Pusat" : "Admin Fakultas"}
                      </Badge>
                    </div>
                    <p className="truncate text-[13px] text-gray-600">
                      {a.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Lingkup:{" "}
                      {isAdminPusat
                        ? "Semua kampus & Area Umum"
                        : activeAreas.length > 0
                          ? activeAreas.map((p) => p.nama_area).join(", ")
                          : "-"}
                    </p>
                  </div>
                </div>

                {!isAdminPusat && activeAreas.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                    {activeAreas.map((p) => (
                      <div
                        key={p.assignment_id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-gray-600">
                          {p.nama_area}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            openRevoke({
                              assignmentId: p.assignment_id,
                              adminName: a.nama,
                              areaName: p.nama_area,
                            })
                          }
                          className="h-7 shrink-0 rounded-full px-3 text-[13px] text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                        >
                          Cabut Akses
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {adding && (
        <ConfirmDialog
          title="Tambah admin fakultas"
          confirmLabel={busy ? "Menyimpan..." : "Tambahkan"}
          onConfirm={() => void confirmAdd()}
          onCancel={() => !busy && setAdding(false)}
        >
          <p>
            Akun harus sudah terdaftar, terverifikasi, dan tidak memiliki klaim
            aktif.
          </p>
          <TextField
            label="Surel kampus"
            type="email"
            placeholder="nama@usu.ac.id atau nama@students.usu.ac.id"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError("");
              setAddError("");
            }}
            error={emailError || undefined}
          />
          <Select
            label="Fakultas cakupan"
            placeholder="Pilih fakultas"
            options={faculties.map((f) => ({ value: f.id, label: f.name }))}
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value);
              setAreaError("");
              setAddError("");
            }}
            error={areaError || undefined}
          />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </ConfirmDialog>
      )}

      {removing && (
        <ConfirmDialog
          title="Cabut akses admin?"
          confirmLabel={busy ? "Memproses..." : "Cabut Akses"}
          danger
          onConfirm={() => void confirmRevoke()}
          onCancel={() => !busy && setRemoving(null)}
        >
          <p>
            <strong>{removing.adminName}</strong> tidak lagi bisa mengakses
            halaman admin untuk <strong>{removing.areaName}</strong>. Tindakan
            ini tercatat di riwayat audit.
          </p>
          <TextField
            label="Alasan pencabutan"
            placeholder="Contoh: Pergantian petugas TU fakultas"
            maxLength={300}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError("");
            }}
            error={reasonError || undefined}
          />
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

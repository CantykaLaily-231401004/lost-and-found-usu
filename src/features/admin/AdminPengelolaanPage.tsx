import { useState } from "react";
import Badge from "../../shared/components/Badge";
import Button from "../../shared/components/Button";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import EmptyState from "../../shared/components/EmptyState";
import Icon from "../../shared/components/Icon";
import Select from "../../shared/components/Select";
import TextField from "../../shared/components/TextField";
import { useAdminSession } from "../../shared/hooks/useIsAdmin";
import { CAMPUS_AREAS } from "../../shared/utils/reportOptions";
import AdminShell from "./AdminShell";
import {
  addAdmin,
  removeAdmin,
  useAdminActor,
  useAdminStore,
  type AdminAccount,
} from "./adminStore";
import { card } from "./adminstyles";
import { PageTitle } from "./adminUI";

const FACULTIES = CAMPUS_AREAS.filter((a) => a !== "Area Umum Kampus");

export default function AdminPengelolaanPage() {
  const session = useAdminSession();
  const actor = useAdminActor();
  const admin = useAdminStore();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [faculty, setFaculty] = useState("");
  const [error, setError] = useState("");

  if (session && session.role !== "pusat") {
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
    setName("");
    setEmail("");
    setFaculty("");
    setError("");
  }

  function confirmAdd() {
    if (!actor) return;
    const err = addAdmin(actor, { name, email, faculty });
    if (err) return setError(err);
    setAdding(false);
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

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {admin.admins.map((a) => (
          <article key={a.id} className={`${card} p-4`}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-800 font-display text-lg font-bold text-white">
                {a.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {a.name}
                  </p>
                  <Badge tone={a.role === "pusat" ? "green" : "soft"}>
                    {a.role === "pusat" ? "Admin Pusat" : "Admin Fakultas"}
                  </Badge>
                </div>
                <p className="truncate text-[13px] text-gray-600">{a.email}</p>
                <p className="text-xs text-gray-500">Lingkup: {a.faculty}</p>
              </div>
            </div>
            {a.role === "fakultas" && (
              <div className="mt-3 flex justify-end border-t border-gray-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => setRemoving(a)}
                  className="h-8 rounded-full px-3 text-[13px] text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                >
                  Hapus Akses
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {adding && (
        <ConfirmDialog
          title="Tambah admin fakultas"
          confirmLabel="Tambahkan"
          onConfirm={confirmAdd}
          onCancel={() => setAdding(false)}
        >
          <p>
            Akun harus sudah terdaftar dan terverifikasi. Pada versi dummy ini,
            data hanya disimpan di browser.
          </p>
          <TextField
            label="Nama"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
          <TextField
            label="Surel kampus"
            type="email"
            placeholder="nama@usu.ac.id"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
          <Select
            label="Fakultas cakupan"
            placeholder="Pilih fakultas"
            options={FACULTIES}
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setError("");
            }}
            error={error}
          />
        </ConfirmDialog>
      )}

      {removing && (
        <ConfirmDialog
          title="Cabut akses admin?"
          confirmLabel="Hapus Akses"
          danger
          onConfirm={() => {
            if (actor) removeAdmin(actor, removing);
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        >
          <p>
            {removing.name} tidak lagi bisa mengakses halaman admin untuk{" "}
            {removing.faculty}. Tindakan ini tercatat di riwayat.
          </p>
        </ConfirmDialog>
      )}
    </AdminShell>
  );
}

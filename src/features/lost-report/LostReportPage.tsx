import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Alert from "../../shared/components/Alert";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import {
  FormCard,
  FormFooter,
  PageHeader,
} from "../../shared/components/FormCard";
import Icon from "../../shared/components/Icon";
import ReportFields from "../../shared/components/ReportFields";
import ReportSuccess from "../../shared/components/ReportSuccess";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import type { Report } from "../../shared/store/lofiStore";
import { fetchAreas, type Area } from "../../services/areas";
import {
  createLostReport,
  getMyActiveLostReport,
  updateLostReport,
  uploadLostPhoto,
  type LostReportInput,
} from "../../services/lostReports";
import { ServiceError, errorMessage } from "../../services/rpc";
import {
  MIN_DESCRIPTION,
  emptyReport,
  focusFirstError,
  reportToValues,
  validateReport,
  type ReportErrors,
  type ReportValues,
} from "../../shared/utils/reportForm";

/** Nama kolom dari RPC (public.rpc_field_error) -> nama kolom di form. */
const FIELD_FROM_DB: Record<string, keyof ReportValues> = {
  kategori: "category",
  kategori_lainnya: "categoryOther",
  deskripsi: "description",
  warna: "color",
  merek: "brand",
  lokasi_kehilangan: "location",
  area_id: "area",
  tanggal_kehilangan: "date",
  jam_kehilangan: "time",
  photos: "photos",
};

function toInput(v: ReportValues): LostReportInput {
  return {
    category: v.category,
    categoryOther: v.categoryOther.trim(),
    description: v.description.trim(),
    color: v.color.trim(),
    brand: v.brand.trim(),
    location: v.location.trim(),
    areaId: v.area,
    date: v.date,
    time: v.time,
  };
}

const TIPS = [
  "Sebutkan ciri khas: stiker, goresan, gantungan, atau isi barang.",
  "Tulis tempat terakhir barang masih terlihat, bukan tempat Anda menyadari kehilangan.",
  "Tambahkan foto jika ada, misalnya foto barang serupa atau foto lama.",
  "Jangan cantumkan NIM, nomor KTP, atau nomor HP di deskripsi.",
];

export default function LostReportPage() {
  const { id } = useParams();
  const { user, ready } = useSessionUser();
  if (!ready || !user) return null;
  return <LostReportForm key={id ?? "baru"} ownerId={user.id} editId={id} />;
}

function LostReportForm({
  ownerId,
  editId,
}: {
  ownerId: string;
  editId?: string;
}) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [existing, setExisting] = useState<Report | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [values, setValues] = useState<ReportValues>(emptyReport);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [formError, setFormError] = useState("");
  const [uploadFailed, setUploadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  // Satu kunci per form: kiriman ulang (klik ganda, koneksi putus) tidak membuat laporan ganda (FR-07).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    Promise.all([fetchAreas(), editId ? getMyActiveLostReport(editId, ownerId) : null])
      .then(([list, report]) => {
        if (!active) return;
        setAreas(list);
        if (editId && !report) return setLoadState("missing");
        if (report) {
          setExisting(report);
          setValues(reportToValues(report));
        }
        setLoadState("ready");
      })
      .catch(() => active && setLoadState("error"));
    return () => {
      active = false;
    };
  }, [editId, ownerId]);

  function change<K extends keyof ReportValues>(
    field: K,
    value: ReportValues[K],
  ) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (field === "photos") setUploadFailed(false);
  }

  /** Unggah foto baru yang belum punya path. Path disimpan di state supaya kiriman ulang tidak mengunggah dua kali. */
  async function uploadNewPhotos(): Promise<ReportValues["photos"]> {
    const folder = `${ownerId}/${existing ? existing.id : requestId}`;
    const photos = await Promise.all(
      values.photos.map(async (p) =>
        p.file && !p.path ? { ...p, path: await uploadLostPhoto(folder, p.file) } : p,
      ),
    );
    setValues((v) => ({ ...v, photos }));
    return photos;
  }

  async function handleSubmit(e?: FormEvent, withoutPhotos = false) {
    e?.preventDefault();
    setFormError("");
    setUploadFailed(false);
    const current = withoutPhotos
      ? { ...values, photos: values.photos.filter((p) => !p.file) }
      : values;
    if (withoutPhotos) setValues(current);
    const next = validateReport(current, "lost");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setLoading(true);
    try {
      let photos = current.photos;
      if (!withoutPhotos) {
        try {
          photos = await uploadNewPhotos();
        } catch {
          setUploadFailed(true);
          setFormError("Foto gagal diunggah. Coba kirim lagi, atau kirim laporan tanpa foto baru.");
          return;
        }
      }
      const newPaths = photos.filter((p) => p.file && p.path).map((p) => p.path as string);
      const input = toInput(current);
      if (existing) {
        const keptIds = new Set(photos.map((p) => p.id).filter(Boolean));
        const removeIds = (existing.photoIds ?? []).filter((id) => !keptIds.has(id));
        const res = await updateLostReport(existing.id, input, newPaths, removeIds);
        setDoneId(res.kode);
      } else {
        const res = await createLostReport(input, requestId, newPaths);
        setDoneId(res.kode);
      }
    } catch (err) {
      const field = err instanceof ServiceError && err.field ? FIELD_FROM_DB[err.field] : undefined;
      if (field) {
        setErrors({ [field]: errorMessage(err) });
        requestAnimationFrame(() => focusFirstError(formRef.current));
      } else {
        setFormError(
          err instanceof ServiceError && err.code !== "UNKNOWN" && err.code !== "NETWORK"
            ? err.message
            : "Laporan belum tersimpan. Periksa koneksi lalu coba lagi.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setValues(emptyReport);
    setErrors({});
    setFormError("");
    setUploadFailed(false);
    setDoneId(null);
    setRequestId(crypto.randomUUID());
  }

  if (loadState === "loading") return <AppShell>{null}</AppShell>;

  if (loadState === "missing" || loadState === "error") {
    return (
      <AppShell>
        <EmptyState
          icon="alert"
          title={loadState === "missing" ? "Laporan tidak dapat diubah" : "Gagal memuat formulir"}
          body={
            loadState === "missing"
              ? "Laporan tidak ditemukan, sudah ditutup, atau bukan milik Anda."
              : "Periksa koneksi Anda lalu muat ulang halaman."
          }
          action={
            <Link to="/laporan-saya">
              <Button
                type="button"
                variant="outline"
                className="h-9! w-auto! px-4! text-[13px]!"
              >
                Ke Laporan Saya
              </Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const checks = [
    { label: "Kategori barang", ok: !!values.category },
    {
      label: `Deskripsi (min. ${MIN_DESCRIPTION} karakter)`,
      ok: values.description.trim().length >= MIN_DESCRIPTION,
    },
    { label: "Lokasi kejadian", ok: !!values.location.trim() },
    { label: "Area kampus", ok: !!values.area },
    { label: "Tanggal kejadian", ok: !!values.date },
  ];
  const done = checks.filter((c) => c.ok).length;
  const percent = Math.round((done / checks.length) * 100);

  return (
    <AppShell wide>
      <PageHeader
        title={existing ? "Ubah Laporan Kehilangan" : "Laporan Kehilangan"}
        subtitle={
          existing
            ? `Perbarui informasi laporan ${existing.kode ?? existing.id}`
            : "Isi formulir berikut untuk melaporkan barang yang hilang"
        }
        onBack={() => navigate(-1)}
      />

      {doneId ? (
        <div className="mx-auto max-w-2xl">
          <ReportSuccess
            id={doneId}
            kind="lost"
            mode={existing ? "edit" : "create"}
            onAgain={reset}
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_19rem]">
          <div className="min-w-0">
            {/* Tips singkat untuk layar kecil */}
            <p className="mb-3 rounded-xl border border-brand-700/30 bg-brand-50/80 px-3.5 py-2.5 text-[13px] leading-5 text-brand-950 xl:hidden">
              Semakin spesifik ciri barang dan lokasi terakhirnya, semakin cepat
              laporan Anda dicocokkan. Jangan cantumkan NIM atau nomor HP.
            </p>

            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <FormCard>
                <ReportFields
                  kind="lost"
                  values={values}
                  errors={errors}
                  onChange={change}
                  areaOptions={areas.map((a) => ({ value: a.id, label: a.name }))}
                />
                {formError && (
                  <div className="space-y-2 px-5 pb-5 sm:px-6">
                    <Alert tone="error">{formError}</Alert>
                    {uploadFailed && (
                      <button
                        type="button"
                        onClick={() => void handleSubmit(undefined, true)}
                        className="text-sm font-medium text-brand-800 underline"
                      >
                        Kirim tanpa foto baru
                      </button>
                    )}
                  </div>
                )}
                <FormFooter>
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="h-10 rounded-full px-5 text-[14px] text-gray-700 hover:text-brand-800"
                  >
                    Batal
                  </button>
                  <Button
                    type="submit"
                    loading={loading}
                    className="h-10! px-6! text-[14px]! sm:w-auto!"
                  >
                    {loading
                      ? "Mengirim..."
                      : existing
                        ? "Simpan Perubahan"
                        : "Kirim Laporan Kehilangan"}
                  </Button>
                </FormFooter>
              </FormCard>
            </form>
          </div>

          {/* Panel samping (layar lebar) */}
          <aside className="hidden space-y-3 xl:sticky xl:top-2 xl:block">
            <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-gray-900">
                  Kelengkapan
                </h2>
                <span className="text-sm font-semibold text-brand-800">
                  {percent}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand-700 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <ul className="mt-3 space-y-1.5">
                {checks.map((c) => (
                  <li
                    key={c.label}
                    className={`flex items-center gap-2 text-[13px] ${
                      c.ok ? "text-brand-800" : "text-gray-500"
                    }`}
                  >
                    {c.ok ? (
                      <Icon name="checkCircle" className="size-4" />
                    ) : (
                      <span className="size-4 rounded-full border border-gray-300" />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <h2 className="font-display text-base font-semibold text-gray-900">
                Tips agar cepat ditemukan
              </h2>
              <ul className="mt-2.5 space-y-2">
                {TIPS.map((t) => (
                  <li
                    key={t}
                    className="flex gap-2 text-[13px] leading-5 text-gray-600"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tag" />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Alert from "../../shared/components/Alert";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import {
  FormCard,
  FormFooter,
  FormSection,
  PageHeader,
} from "../../shared/components/FormCard";
import Icon from "../../shared/components/Icon";
import ReportFields from "../../shared/components/ReportFields";
import ReportSuccess from "../../shared/components/ReportSuccess";
import Req from "../../shared/components/Req";
import Stepper from "../../shared/components/Stepper";
import TextField from "../../shared/components/TextField";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import type { Report } from "../../shared/store/lofiStore";
import { fetchAreas, type Area } from "../../services/areas";
import {
  createFoundReport,
  getMyEditableFoundReport,
  updateFoundReport,
  uploadFoundPhoto,
  type FoundReportInput,
} from "../../services/foundReports";
import { ServiceError, errorMessage } from "../../services/rpc";
import {
  emptyReport,
  focusFirstError,
  reportToValues,
  validateReport,
  type ReportErrors,
  type ReportValues,
} from "../../shared/utils/reportForm";

const STEPS = ["Info Publik", "Ciri Rahasia", "Pratinjau"] as const;
/** Form menyediakan 3 kolom (1 wajib); database menerima 1–5 ciri. */
const SECRET_SLOTS = 3;
const MIN_SECRET = 3;
const MAX_SECRET = 500;

/** Nama kolom dari RPC (public.rpc_field_error) -> nama kolom di form. */
const FIELD_FROM_DB: Record<string, keyof ReportValues> = {
  kategori: "category",
  kategori_lainnya: "categoryOther",
  deskripsi: "description",
  warna: "color",
  merek: "brand",
  lokasi_temuan: "location",
  area_id: "area",
  tanggal_temuan: "date",
  jam_temuan: "time",
  photos: "photos",
};

function toInput(v: ReportValues): FoundReportInput {
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

/** Error per kolom ciri. Kolom kosong dilewati; minimal satu kolom harus terisi. */
function validateSecrets(secrets: string[]): string[] {
  const errs: string[] = secrets.map((s) => {
    const n = s.trim().length;
    if (n === 0) return "";
    if (n < MIN_SECRET) return `Minimal ${MIN_SECRET} karakter.`;
    if (n > MAX_SECRET) return `Maksimal ${MAX_SECRET} karakter.`;
    return "";
  });
  if (secrets.every((s) => !s.trim()))
    errs[0] = `Isi minimal satu ciri rahasia (minimal ${MIN_SECRET} karakter).`;
  return errs;
}

/** "Ciri rahasia ke-2 ..." dari RPC dihitung dari ciri yang terisi; ubah ke nomor kolom di form. */
function secretSlotFromMessage(secrets: string[], message: string): number {
  const n = Number(/ke-(\d+)/.exec(message)?.[1] ?? 0);
  if (!n) return 0;
  const filled = secrets.map((s, i) => (s.trim() ? i : -1)).filter((i) => i >= 0);
  return filled[n - 1] ?? 0;
}

const STEP_HINTS = [
  "Isi data yang akan tampil di katalog publik.",
  "Tulis ciri yang hanya diketahui pemilik asli.",
  "Periksa kembali sebelum diterbitkan.",
];

const TIPS = [
  "Info publik tampil di katalog. Jangan sebut ciri rahasia, kontak pribadi, atau nomor identitas.",
  "Ciri rahasia hanya terlihat oleh Anda dan admin berwenang, dipakai untuk mencocokkan bukti pemilik.",
  "Jangan membuka perangkat terkunci atau mengakses data sensitif untuk mencari ciri barang.",
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "-"}</dd>
    </div>
  );
}

export default function FoundReportPage() {
  const { id } = useParams();
  const { user, ready } = useSessionUser();
  if (!ready || !user) return null;
  return <FoundReportForm key={id ?? "baru"} ownerId={user.id} editId={id} />;
}

function FoundReportForm({
  ownerId,
  editId,
}: {
  ownerId: string;
  editId?: string;
}) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [existing, setExisting] = useState<Report | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ReportValues>(emptyReport);
  const [secrets, setSecrets] = useState<string[]>(() => Array(SECRET_SLOTS).fill(""));
  const [errors, setErrors] = useState<ReportErrors>({});
  const [secretErrors, setSecretErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [uploadFailed, setUploadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  // Satu kunci per form: kiriman ulang (klik ganda, koneksi putus) tidak membuat laporan ganda (FR-09).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    Promise.all([fetchAreas(), editId ? getMyEditableFoundReport(editId, ownerId) : null])
      .then(([list, report]) => {
        if (!active) return;
        setAreas(list);
        if (editId && !report) return setLoadState("missing");
        if (report) {
          setExisting(report);
          setValues(reportToValues(report));
          setSecrets(
            Array.from(
              { length: Math.max(SECRET_SLOTS, report.secrets.length) },
              (_, i) => report.secrets[i] ?? "",
            ),
          );
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

  function goTo(n: number) {
    setStep(n);
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function handleNext() {
    if (step === 0) {
      const next = validateReport(values, "found");
      setErrors(next);
      if (Object.keys(next).length > 0) {
        requestAnimationFrame(() => focusFirstError(formRef.current));
        return;
      }
      goTo(1);
    } else if (step === 1) {
      const next = validateSecrets(secrets);
      setSecretErrors(next);
      if (next.some(Boolean)) {
        requestAnimationFrame(() => focusFirstError(formRef.current));
        return;
      }
      goTo(2);
    }
  }

  /** Unggah foto baru yang belum punya path. Path disimpan di state supaya kiriman ulang tidak mengunggah dua kali. */
  async function uploadNewPhotos(): Promise<ReportValues["photos"]> {
    const folder = `${ownerId}/${existing ? existing.id : requestId}`;
    const photos = await Promise.all(
      values.photos.map(async (p) =>
        p.file && !p.path ? { ...p, path: await uploadFoundPhoto(folder, p.file) } : p,
      ),
    );
    setValues((v) => ({ ...v, photos }));
    return photos;
  }

  async function handleSubmit(e?: FormEvent, withoutPhotos = false) {
    e?.preventDefault();
    if (step < 2) return handleNext();
    setFormError("");
    setUploadFailed(false);
    const current = withoutPhotos
      ? { ...values, photos: values.photos.filter((p) => !p.file) }
      : values;
    if (withoutPhotos) setValues(current);
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
        const res = await updateFoundReport(existing.id, input, secrets, newPaths, removeIds);
        setDoneId(res.kode);
      } else {
        const res = await createFoundReport(input, secrets, requestId, newPaths);
        setDoneId(res.kode);
      }
    } catch (err) {
      const dbField = err instanceof ServiceError ? err.field : undefined;
      if (dbField === "ciri_rahasia") {
        const slot = secretSlotFromMessage(secrets, errorMessage(err));
        setSecretErrors(secrets.map((_, i) => (i === slot ? errorMessage(err) : "")));
        goTo(1);
        requestAnimationFrame(() => focusFirstError(formRef.current));
      } else if (dbField && FIELD_FROM_DB[dbField]) {
        setErrors({ [FIELD_FROM_DB[dbField]]: errorMessage(err) });
        goTo(0);
        requestAnimationFrame(() => focusFirstError(formRef.current));
      } else {
        setFormError(
          err instanceof ServiceError && err.code !== "UNKNOWN" && err.code !== "NETWORK"
            ? err.message
            : "Laporan belum tersimpan dan belum diterbitkan. Periksa koneksi lalu coba lagi.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setValues(emptyReport);
    setSecrets(Array(SECRET_SLOTS).fill(""));
    setErrors({});
    setSecretErrors([]);
    setFormError("");
    setUploadFailed(false);
    setStep(0);
    setDoneId(null);
    setRequestId(crypto.randomUUID());
  }

  const filledSecrets = secrets.map((s) => s.trim()).filter(Boolean);
  const when = values.date + (values.time ? `, ${values.time}` : "");
  const areaName = areas.find((a) => a.id === values.area)?.name ?? values.area;

  if (loadState === "loading") return <AppShell>{null}</AppShell>;

  if (loadState === "missing" || loadState === "error") {
    return (
      <AppShell>
        <EmptyState
          icon="alert"
          title={loadState === "missing" ? "Laporan tidak dapat diubah" : "Gagal memuat formulir"}
          body={
            loadState === "missing"
              ? "Laporan hanya bisa diubah saat berstatus Tersedia dan belum ada klaim aktif. Jika perlu, hubungi admin."
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

  return (
    <AppShell wide>
      <div ref={topRef} className="scroll-mt-4">
        <PageHeader
          title={existing ? "Ubah Laporan Penemuan" : "Laporan Penemuan"}
          subtitle={
            existing
              ? `Perbarui informasi laporan ${existing.kode ?? existing.id}`
              : "Isi formulir berikut untuk melaporkan barang yang Anda temukan"
          }
          onBack={() => navigate(-1)}
        />
      </div>

      {doneId ? (
        <div className="mx-auto max-w-2xl">
          <ReportSuccess
            id={doneId}
            kind="found"
            mode={existing ? "edit" : "create"}
            onAgain={reset}
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_19rem]">
          <div className="min-w-0">
            <div className="mb-4 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <Stepper steps={STEPS} current={step} />
            </div>

            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <FormCard>
                <div hidden={step !== 0} className="border-b border-gray-200/80">
                  <ReportFields
                    kind="found"
                    values={values}
                    errors={errors}
                    onChange={change}
                    areaOptions={areas.map((a) => ({ value: a.id, label: a.name }))}
                  />
                </div>

                {step === 1 && (
                  <FormSection
                    title={
                      <span className="flex items-center gap-2 text-base normal-case tracking-normal">
                        <Icon name="lock" className="size-4 text-brand-800" />
                        Ciri Rahasia
                      </span>
                    }
                  >
                    <Alert>
                      Ciri ini hanya terlihat oleh Anda dan admin berwenang,
                      tidak tampil di katalog. Jangan membuka perangkat terkunci
                      atau mengakses informasi sensitif untuk mencarinya. Jika
                      belum bisa menentukan ciri, minta bantuan pengelola.
                    </Alert>
                    <p className="text-sm text-gray-600">
                      Tulis hal yang hanya diketahui pemilik asli, misalnya
                      nomor seri, isi di dalam, atau tanda khusus.
                    </p>
                    {secrets.map((s, i) => (
                      <TextField
                        key={i}
                        label={
                          i === 0 ? (
                            <Req>Ciri rahasia 1</Req>
                          ) : (
                            `Ciri rahasia ${i + 1} (opsional)`
                          )
                        }
                        placeholder={
                          i === 0
                            ? "Cth: Ada stiker kucing di bagian dalam"
                            : "Ciri tambahan"
                        }
                        value={s}
                        maxLength={MAX_SECRET}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSecrets((arr) =>
                            arr.map((x, j) => (j === i ? v : x)),
                          );
                          setSecretErrors((arr) =>
                            arr.map((x, j) => (j === i ? "" : x)),
                          );
                        }}
                        error={secretErrors[i] || undefined}
                      />
                    ))}
                  </FormSection>
                )}

                {step === 2 && (
                  <>
                    <FormSection title="Tampil di katalog publik">
                      <dl className="space-y-3">
                        <Row
                          label="Kategori"
                          value={
                            values.categoryOther
                              ? `${values.category}: ${values.categoryOther.trim()}`
                              : values.category
                          }
                        />
                        <Row
                          label="Deskripsi"
                          value={values.description.trim()}
                        />
                        <Row label="Warna" value={values.color} />
                        <Row label="Merek" value={values.brand} />
                        <Row label="Lokasi" value={values.location} />
                        <Row label="Area penanganan" value={areaName} />
                        <Row label="Tanggal" value={when} />
                      </dl>
                      {values.photos.length > 0 && (
                        <ul className="grid grid-cols-3 gap-3">
                          {values.photos.map((p, i) => (
                            <li
                              key={p.url}
                              className="aspect-square overflow-hidden rounded-xl border border-gray-200"
                            >
                              <img
                                src={p.url}
                                alt={`Foto ${i + 1}`}
                                className="size-full object-cover"
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </FormSection>
                    <FormSection
                      title={
                        <span className="flex items-center gap-2">
                          <Icon name="lock" className="size-4 text-brand-800" />
                          Ciri rahasia (tidak ditampilkan publik)
                        </span>
                      }
                    >
                      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-900">
                        {filledSecrets.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </FormSection>
                  </>
                )}

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
                  {step === 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="h-10 rounded-full px-5 text-[14px] text-gray-700 hover:text-brand-800"
                    >
                      Batal
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => goTo(step - 1)}
                      className="h-10 rounded-full px-5 text-[14px] text-gray-700 hover:text-brand-800 disabled:opacity-60"
                    >
                      ← Kembali
                    </button>
                  )}
                  {step < 2 ? (
                    <Button
                      key="next"
                      type="button"
                      onClick={handleNext}
                      className="h-10! rounded-full! px-6! text-[14px]! sm:w-auto!"
                    >
                      {step === 0
                        ? "Lanjut ke Ciri Rahasia →"
                        : "Lanjut ke Pratinjau →"}
                    </Button>
                  ) : (
                    <Button
                      key="submit"
                      type="submit"
                      loading={loading}
                      className="h-10! rounded-full! px-6! text-[14px]! sm:w-auto!"
                    >
                      {loading
                        ? "Mengirim..."
                        : existing
                          ? "Simpan Perubahan"
                          : "Kirim Laporan Temuan"}
                    </Button>
                  )}
                </FormFooter>
              </FormCard>
            </form>
          </div>

          {/* Panel samping (layar lebar) */}
          <aside className="hidden space-y-3 xl:sticky xl:top-2 xl:block">
            <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-800">
                Langkah {step + 1} dari {STEPS.length}
              </p>
              <h2 className="mt-1 font-display text-base font-semibold text-gray-900">
                {STEPS[step]}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-gray-600">
                {STEP_HINTS[step]}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand-700 transition-all duration-300"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <h2 className="font-display text-base font-semibold text-gray-900">
                Yang perlu diperhatikan
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

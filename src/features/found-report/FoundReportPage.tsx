import { useRef, useState, type FormEvent } from "react";
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
import {
  addReport,
  hasActiveClaim,
  updateReport,
  useLofiStore,
} from "../../shared/store/lofiStore";
import {
  emptyReport,
  focusFirstError,
  reportToValues,
  submitReportDummy,
  validateReport,
  valuesToInput,
  type ReportErrors,
  type ReportValues,
} from "../../shared/utils/reportForm";

const STEPS = ["Info Publik", "Ciri Rahasia", "Pratinjau"] as const;
const SECRET_SLOTS = 3;

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
  const store = useLofiStore();
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const existing = editId
    ? store.reports.find(
        (r) =>
          r.id === editId &&
          r.kind === "found" &&
          r.ownerId === ownerId &&
          r.status === "Tersedia" &&
          !hasActiveClaim(store, r.id),
      )
    : undefined;

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ReportValues>(() =>
    existing ? reportToValues(existing) : emptyReport,
  );
  const [secrets, setSecrets] = useState<string[]>(() =>
    Array.from({ length: SECRET_SLOTS }, (_, i) => existing?.secrets[i] ?? ""),
  );
  const [errors, setErrors] = useState<ReportErrors>({});
  const [secretError, setSecretError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  function change<K extends keyof ReportValues>(
    field: K,
    value: ReportValues[K],
  ) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
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
      if (secrets.every((s) => s.trim().length < 3)) {
        setSecretError("Isi minimal satu ciri rahasia (minimal 3 karakter).");
        requestAnimationFrame(() => focusFirstError(formRef.current));
        return;
      }
      setSecretError("");
      goTo(2);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < 2) return handleNext();
    setFormError("");
    setLoading(true);
    try {
      await submitReportDummy("found");
      const input = await valuesToInput("found", values, secrets);
      if (existing) {
        updateReport(existing.id, input);
        setDoneId(existing.id);
      } else {
        setDoneId(addReport(input, ownerId).id);
      }
    } catch {
      setFormError(
        "Laporan belum tersimpan dan belum diterbitkan. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setValues(emptyReport);
    setSecrets(Array(SECRET_SLOTS).fill(""));
    setErrors({});
    setSecretError("");
    setFormError("");
    setStep(0);
    setDoneId(null);
  }

  const filledSecrets = secrets.map((s) => s.trim()).filter(Boolean);
  const when = values.date + (values.time ? `, ${values.time}` : "");

  if (editId && !existing && !doneId) {
    return (
      <AppShell>
        <EmptyState
          icon="alert"
          title="Laporan tidak dapat diubah"
          body="Laporan hanya bisa diubah saat berstatus Tersedia dan belum ada klaim aktif. Jika perlu, hubungi admin."
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
              ? `Perbarui informasi laporan ${existing.id}`
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
                {step === 0 && (
                  <ReportFields
                    kind="found"
                    values={values}
                    errors={errors}
                    onChange={change}
                  />
                )}

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
                        onChange={(e) => {
                          const v = e.target.value;
                          setSecrets((arr) =>
                            arr.map((x, j) => (j === i ? v : x)),
                          );
                          setSecretError("");
                        }}
                        error={i === 0 ? secretError : undefined}
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
                        <Row label="Area penanganan" value={values.area} />
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
                        {filledSecrets.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </FormSection>
                  </>
                )}

                {formError && (
                  <div className="px-5 pb-5 sm:px-6">
                    <Alert tone="error">{formError}</Alert>
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

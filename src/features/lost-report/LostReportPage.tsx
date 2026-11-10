import { useRef, useState, type FormEvent } from "react";
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
import {
  addReport,
  updateReport,
  useLofiStore,
} from "../../shared/store/lofiStore";
import {
  MIN_DESCRIPTION,
  emptyReport,
  focusFirstError,
  reportToValues,
  submitReportDummy,
  validateReport,
  valuesToInput,
  type ReportErrors,
  type ReportValues,
} from "../../shared/utils/reportForm";

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
  const store = useLofiStore();
  const formRef = useRef<HTMLFormElement>(null);

  const existing = editId
    ? store.reports.find(
        (r) =>
          r.id === editId &&
          r.kind === "lost" &&
          r.ownerId === ownerId &&
          r.status === "Aktif",
      )
    : undefined;

  const [values, setValues] = useState<ReportValues>(() =>
    existing ? reportToValues(existing) : emptyReport,
  );
  const [errors, setErrors] = useState<ReportErrors>({});
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const next = validateReport(values, "lost");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setLoading(true);
    try {
      await submitReportDummy("lost");
      const input = await valuesToInput("lost", values);
      if (existing) {
        updateReport(existing.id, input);
        setDoneId(existing.id);
      } else {
        setDoneId(addReport(input, ownerId).id);
      }
    } catch {
      setFormError("Laporan belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setValues(emptyReport);
    setErrors({});
    setFormError("");
    setDoneId(null);
  }

  if (editId && !existing && !doneId) {
    return (
      <AppShell>
        <EmptyState
          icon="alert"
          title="Laporan tidak dapat diubah"
          body="Laporan tidak ditemukan, sudah ditutup, atau bukan milik Anda."
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
    { label: "Fakultas / gedung", ok: !!values.area },
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
            ? `Perbarui informasi laporan ${existing.id}`
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
                />
                {formError && (
                  <div className="px-5 pb-5 sm:px-6">
                    <Alert tone="error">{formError}</Alert>
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

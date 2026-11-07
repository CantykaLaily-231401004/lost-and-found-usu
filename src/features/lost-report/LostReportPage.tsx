import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Alert from "../../shared/components/Alert";
import Button from "../../shared/components/Button";
import EmptyState from "../../shared/components/EmptyState";
import { FormCard, FormFooter, PageHeader } from "../../shared/components/FormCard";
import ReportFields from "../../shared/components/ReportFields";
import ReportSuccess from "../../shared/components/ReportSuccess";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  addReport,
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

  function change<K extends keyof ReportValues>(field: K, value: ReportValues[K]) {
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
              <Button type="button" className="w-auto!">
                Ke Laporan Saya
              </Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
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
        <ReportSuccess
          id={doneId}
          kind="lost"
          mode={existing ? "edit" : "create"}
          onAgain={reset}
        />
      ) : (
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
                className="h-11 rounded-lg px-5 text-[15px] text-gray-700 hover:text-brand-800"
              >
                Batal
              </button>
              <Button type="submit" loading={loading} className="sm:w-auto!">
                {loading
                  ? "Mengirim..."
                  : existing
                    ? "Simpan Perubahan"
                    : "Kirim Laporan Kehilangan"}
              </Button>
            </FormFooter>
          </FormCard>
        </form>
      )}
    </AppShell>
  );
}

import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../shared/components/AppShell";
import Alert from "../../shared/components/Alert";
import Button from "../../shared/components/Button";
import { FormCard, FormFooter, PageHeader } from "../../shared/components/FormCard";
import ReportFields from "../../shared/components/ReportFields";
import ReportSuccess from "../../shared/components/ReportSuccess";
import {
  emptyReport,
  focusFirstError,
  submitReportDummy,
  validateReport,
  type ReportErrors,
  type ReportValues,
} from "../../shared/utils/reportForm";

export default function LostReportPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ReportValues>(emptyReport);
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
      const { id } = await submitReportDummy("lost");
      setDoneId(id);
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

  return (
    <AppShell>
      <PageHeader
        title="Laporan Kehilangan"
        subtitle="Isi formulir berikut untuk melaporkan barang yang hilang"
        onBack={() => navigate(-1)}
      />
      {doneId ? (
        <ReportSuccess id={doneId} kind="lost" onAgain={reset} />
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
                {loading ? "Mengirim..." : "Kirim Laporan Kehilangan"}
              </Button>
            </FormFooter>
          </FormCard>
        </form>
      )}
    </AppShell>
  );
}

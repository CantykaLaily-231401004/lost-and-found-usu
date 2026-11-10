import { useState, type FormEvent } from "react";
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
import ReportThumb, {
  ReportKindBadge,
} from "../../shared/components/ReportThumb";
import Req from "../../shared/components/Req";
import TextArea from "../../shared/components/TextArea";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  addClaim,
  categoryLabel,
  useLofiStore,
} from "../../shared/store/lofiStore";

const MIN_EVIDENCE = 30;

const GUIDE = [
  "Jelaskan ciri khas yang spesifik: nomor seri, isi di dalam, nama tertulis, atau tanda khusus.",
  "Jangan menanyakan ciri rahasia kepada penemu terlebih dahulu.",
  "Admin akan mencocokkan bukti Anda dengan ciri rahasia dari penemu.",
];

export default function AjukanKlaimPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const store = useLofiStore();
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const report = store.reports.find((r) => r.id === reportId);
  const duplicate = store.claims.some(
    (c) =>
      c.ownerId === user?.id &&
      c.reportId === reportId &&
      (c.status === "Menunggu" || c.status === "Disetujui"),
  );
  const claimable =
    report &&
    report.kind === "found" &&
    report.status === "Tersedia" &&
    report.ownerId !== user?.id;

  if (!claimable || duplicate) {
    return (
      <AppShell>
        <EmptyState
          icon="alert"
          title={
            duplicate ? "Klaim sudah diajukan" : "Barang tidak bisa diklaim"
          }
          body={
            duplicate
              ? "Anda sudah memiliki klaim aktif untuk barang ini. Pantau statusnya di Klaim Saya."
              : "Barang tidak ditemukan, sudah tidak tersedia, atau merupakan laporan Anda sendiri."
          }
          action={
            <Link to={duplicate ? "/klaim-saya" : "/cari"}>
              <Button
                type="button"
                variant="outline"
                className="h-9! w-auto! px-4! text-[13px]!"
              >
                {duplicate ? "Ke Klaim Saya" : "Kembali ke Cari Barang"}
              </Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (evidence.trim().length < MIN_EVIDENCE)
      return setError(`Bukti minimal ${MIN_EVIDENCE} karakter.`);
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    addClaim(report!.id, evidence, user!.id);
    navigate("/klaim-saya");
  }

  const count = evidence.trim().length;
  const ready = count >= MIN_EVIDENCE;

  return (
    <AppShell wide>
      <PageHeader
        title="Ajukan Klaim"
        subtitle="Buktikan kepemilikan barang temuan"
        onBack={() => navigate(-1)}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_19rem]">
        {/* Kanan di layar lebar, di atas form di layar kecil */}
        <aside className="space-y-3 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-2">
          <section className="rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Barang yang diklaim
            </p>
            <div className="mt-2.5 flex gap-3">
              <ReportThumb
                report={report}
                className="size-16 shrink-0 rounded-xl"
                iconClass="size-7"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ReportKindBadge kind="found" />
                  <span className="font-mono text-xs text-gray-500">
                    {report.id}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-gray-900">
                  {report.description}
                </p>
              </div>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-gray-600">
              <Icon name="pin" className="size-4 shrink-0 text-brand-800" />
              {report.location} · {categoryLabel(report)}
            </p>
          </section>

          <section className="rounded-2xl border border-brand-700/30 bg-brand-50/80 p-3.5">
            <h2 className="font-display text-base font-semibold text-brand-950">
              Panduan pengisian bukti
            </h2>
            <ul className="mt-2 space-y-1.5">
              {GUIDE.map((t) => (
                <li
                  key={t}
                  className="flex gap-2 text-[13px] leading-5 text-brand-950"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-700" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="min-w-0 xl:col-start-1 xl:row-start-1"
        >
          <FormCard>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              <TextArea
                label={<Req>Bukti Kepemilikan</Req>}
                hint="Sebutkan ciri khas spesifik yang hanya diketahui oleh pemilik asli (nomor seri, isi di dalam, nama tertulis, dll.)"
                placeholder="Cth: Dompet saya berisi KTM atas nama saya, ada foto keluarga di slot foto kanan, dan uang tunai sekitar Rp150.000..."
                rows={6}
                minChars={MIN_EVIDENCE}
                value={evidence}
                onChange={(e) => {
                  setEvidence(e.target.value);
                  setError("");
                }}
                error={error}
              />
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    ready ? "bg-brand-700" : "bg-tag"
                  }`}
                  style={{
                    width: `${Math.min(100, (count / MIN_EVIDENCE) * 100)}%`,
                  }}
                />
              </div>
              <Alert>
                Klaim duplikat atau pengajuan berulang yang tidak berdasar dapat
                membatasi akses Anda.
              </Alert>
            </div>
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
                className="h-10! rounded-full! px-6! text-[14px]! sm:w-auto!"
              >
                {loading ? "Mengirim..." : "Ajukan Klaim"}
              </Button>
            </FormFooter>
          </FormCard>
        </form>
      </div>
    </AppShell>
  );
}

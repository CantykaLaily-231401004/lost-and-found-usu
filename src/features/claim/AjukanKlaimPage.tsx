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
import Req from "../../shared/components/Req";
import TextArea from "../../shared/components/TextArea";
import { useSessionUser } from "../../shared/hooks/useSessionUser";
import {
  addClaim,
  categoryLabel,
  useLofiStore,
} from "../../shared/store/lofiStore";

const MIN_EVIDENCE = 30;

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
          title={duplicate ? "Klaim sudah diajukan" : "Barang tidak bisa diklaim"}
          body={
            duplicate
              ? "Anda sudah memiliki klaim aktif untuk barang ini. Pantau statusnya di Klaim Saya."
              : "Barang tidak ditemukan, sudah tidak tersedia, atau merupakan laporan Anda sendiri."
          }
          action={
            <Link to={duplicate ? "/klaim-saya" : "/cari"}>
              <Button type="button" className="w-auto!">
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

  return (
    <AppShell>
      <PageHeader
        title="Ajukan Klaim"
        subtitle="Buktikan kepemilikan barang temuan"
        onBack={() => navigate(-1)}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Barang yang diklaim
        </p>
        <p className="mt-1 text-[15px] font-medium text-gray-900">
          {report.description}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
          <Icon name="pin" className="size-4" />
          {report.location} · {categoryLabel(report)}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-brand-700/30 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-950">
        <strong>Panduan pengisian bukti:</strong> Jelaskan ciri khas barang milik
        Anda yang spesifik dan dapat membuktikan kepemilikan. Jangan tanyakan
        dulu ciri rahasia kepada penemu. Admin akan mencocokkan bukti Anda
        dengan ciri rahasia.
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
        <FormCard>
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <TextArea
              label={<Req>Bukti Kepemilikan</Req>}
              hint="Sebutkan ciri khas spesifik yang hanya diketahui oleh pemilik asli (nomor seri, isi di dalam, nama tertulis, dll.)"
              placeholder="Cth: Dompet saya berisi KTM atas nama saya, ada foto keluarga di slot foto kanan, dan uang tunai sekitar Rp150.000..."
              rows={5}
              minChars={MIN_EVIDENCE}
              value={evidence}
              onChange={(e) => {
                setEvidence(e.target.value);
                setError("");
              }}
              error={error}
            />
            <Alert>
              Klaim duplikat atau pengajuan berulang yang tidak berdasar dapat
              membatasi akses Anda.
            </Alert>
          </div>
          <FormFooter>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-11 rounded-lg px-5 text-[15px] text-gray-700 hover:text-brand-800"
            >
              Batal
            </button>
            <Button type="submit" loading={loading} className="sm:w-auto!">
              {loading ? "Mengirim..." : "Ajukan Klaim"}
            </Button>
          </FormFooter>
        </FormCard>
      </form>
    </AppShell>
  );
}

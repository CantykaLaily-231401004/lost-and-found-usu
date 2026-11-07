import { Link } from "react-router-dom";
import Button from "./Button";
import Icon from "./Icon";

export default function ReportSuccess({
  id,
  kind,
  mode = "create",
  onAgain,
}: {
  id: string;
  kind: "lost" | "found";
  mode?: "create" | "edit";
  onAgain: () => void;
}) {
  const lost = kind === "lost";
  const title =
    mode === "edit"
      ? "Perubahan laporan tersimpan"
      : lost
        ? "Laporan kehilangan terkirim"
        : "Laporan temuan terkirim";
  const body =
    mode === "edit"
      ? "Perubahan Anda sudah disimpan dan tampil di katalog."
      : lost
        ? "Laporan Anda sudah aktif dan muncul di Laporan Saya serta katalog pencarian."
        : "Terima kasih sudah melapor. Data katalog sudah terbit tanpa ciri rahasia dan kontak pribadi Anda.";

  return (
    <div
      role="status"
      className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        <Icon name="checkCircle" className="size-8" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">
        {body}
      </p>
      <p className="mt-4 inline-block rounded-md bg-surface px-3 py-1 font-mono text-sm text-gray-700">
        {id}
      </p>
      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:flex-row">
        {mode === "create" ? (
          <Button type="button" variant="outline" onClick={onAgain}>
            Buat laporan lagi
          </Button>
        ) : (
          <Link to="/cari" className="block w-full">
            <Button type="button" variant="outline">
              Cari Barang
            </Button>
          </Link>
        )}
        <Link to="/laporan-saya" className="block w-full">
          <Button type="button">Lihat Laporan Saya</Button>
        </Link>
      </div>
    </div>
  );
}

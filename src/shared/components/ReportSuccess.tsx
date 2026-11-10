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
      ? "Perubahan tersimpan"
      : lost
        ? "Laporan kehilangan terkirim"
        : "Laporan temuan terkirim";
  const body =
    mode === "edit"
      ? "Perubahan Anda sudah disimpan dan tampil di katalog."
      : lost
        ? "Laporan Anda sudah aktif dan muncul di Laporan Saya serta katalog pencarian."
        : "Terima kasih sudah melapor. Data katalog sudah terbit tanpa ciri rahasia dan kontak pribadi Anda.";

  const next =
    mode === "edit"
      ? []
      : lost
        ? [
            "Pantau status laporan Anda di menu Laporan Saya.",
            "Laporan bisa diubah atau ditutup kapan saja selama masih aktif.",
            "Cari juga di katalog, siapa tahu barang Anda sudah ditemukan orang lain.",
          ]
        : [
            "Barang tampil di katalog tanpa ciri rahasia Anda.",
            "Jika ada yang mengklaim, admin mencocokkan bukti dengan ciri rahasia dari Anda.",
            "Jadwal serah terima akan muncul di menu Jadwal setelah klaim disetujui.",
          ];

  return (
    <div
      role="status"
      className="overflow-clip rounded-2xl border border-white/80 bg-white/90 shadow-sm"
    >
      <div className="panel-green px-5 py-6 text-center text-white">
        <span className="pop mx-auto flex size-14 items-center justify-center rounded-full bg-white/15 ring-6 ring-white/10">
          <Icon name="checkCircle" className="size-7" />
        </span>
        <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-white/80">
          {body}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 font-mono text-xs">
          <span className="text-white/70">ID</span>
          {id}
        </p>
      </div>

      <div className="px-5 py-4">
        {next.length > 0 && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Selanjutnya
            </h3>
            <ul className="mt-2.5 space-y-2">
              {next.map((t) => (
                <li
                  key={t}
                  className="flex gap-2 text-[13px] leading-5 text-gray-600"
                >
                  <Icon
                    name="check"
                    className="mt-0.5 size-4 shrink-0 text-brand-700"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        <div
          className={`grid gap-2 sm:grid-cols-2 ${next.length > 0 ? "mt-4" : ""}`}
        >
          {mode === "create" ? (
            <Button
              type="button"
              variant="outline"
              onClick={onAgain}
              className="h-9! rounded-full! whitespace-nowrap text-[13px]!"
            >
              Buat laporan lagi
            </Button>
          ) : (
            <Link to="/cari" className="block">
              <Button
                type="button"
                variant="outline"
                className="h-9! rounded-full! whitespace-nowrap text-[13px]!"
              >
                Cari Barang
              </Button>
            </Link>
          )}
          <Link to="/laporan-saya" className="block">
            <Button
              type="button"
              className="h-9! rounded-full! whitespace-nowrap text-[13px]!"
            >
              Lihat Laporan Saya
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

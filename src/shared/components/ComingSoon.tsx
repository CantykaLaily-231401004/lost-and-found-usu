import AppShell from "./AppShell";
import Icon from "./Icon";

/**
 * Halaman sementara untuk menu yang belum dibuat.
 * Saat halaman aslinya jadi, ganti elemen route-nya di App.tsx.
 */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <Icon name="file" className="mx-auto size-10 text-gray-400" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-gray-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Halaman ini belum dibuat. Segera hadir.
        </p>
      </div>
    </AppShell>
  );
}

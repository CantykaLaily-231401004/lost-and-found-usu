import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Button from "./Button";
import Icon from "./Icon";

export type Photo = { file: File | null; url: string };

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png"];

type Props = {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  error?: string;
};

export default function PhotoUpload({ photos, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_PHOTOS;
  const [localError, setLocalError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Bebaskan URL pratinjau saat komponen dilepas.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  });
  useEffect(
    () => () =>
      latest.current.forEach((p) => p.file && URL.revokeObjectURL(p.url)),
    [],
  );

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (full) return;
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!full) setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setDragging(false);
  }

  function addFiles(picked: File[]) {
    const problems: string[] = [];
    const accepted: Photo[] = [];

    for (const file of picked) {
      if (!ACCEPT.includes(file.type)) {
        problems.push(`"${file.name}" bukan JPG/PNG.`);
      } else if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`"${file.name}" lebih dari 2 MB.`);
      } else if (photos.length + accepted.length >= MAX_PHOTOS) {
        problems.push(`Maksimal ${MAX_PHOTOS} foto.`);
        break;
      } else {
        accepted.push({ file, url: URL.createObjectURL(file) });
      }
    }
    setLocalError(problems.join(" "));
    if (accepted.length) onChange([...photos, ...accepted]);
  }

  function remove(i: number) {
    if (photos[i].file) URL.revokeObjectURL(photos[i].url);
    onChange(photos.filter((_, idx) => idx !== i));
    setLocalError("");
  }

  const shownError = localError || error;

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed px-4 py-8 text-center transition ${
          dragging
            ? "border-brand-700 bg-brand-50"
            : shownError
              ? "border-red-400 bg-white"
              : "border-gray-300 bg-white"
        }`}
      >
        <Icon name="image" className="mx-auto size-9 text-gray-400" />
        <p className="mt-3 text-sm text-gray-600">
          {dragging
            ? "Lepaskan foto di sini"
            : `Tarik dan lepas foto di sini, atau pilih dari perangkat (maks. ${MAX_PHOTOS} foto, JPG/PNG, maks. 2 MB/foto)`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          hidden
          onChange={handlePick}
        />
        <Button
          type="button"
          variant="outline"
          disabled={full}
          onClick={() => inputRef.current?.click()}
          className="mt-4 h-9 w-auto! text-sm"
        >
          {full ? "Batas foto tercapai" : "Pilih Foto"}
        </Button>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {photos.map((p, i) => (
            <li
              key={p.url}
              className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              <img
                src={p.url}
                alt={`Foto ${i + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Hapus foto ${i + 1}`}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-brand-950/80 text-white hover:bg-brand-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Icon name="x" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {shownError && (
        <p role="alert" aria-invalid="true" tabIndex={-1} className="text-sm text-red-600">
          {shownError}
        </p>
      )}
    </div>
  );
}

import Alert from "./Alert";
import { FormSection } from "./FormCard";
import PhotoUpload from "./PhotoUpload";
import Req from "./Req";
import Select from "./Select";
import TextArea from "./TextArea";
import TextField from "./TextField";
import {
  CAMPUS_AREAS,
  CATEGORIES,
  OTHER_CATEGORY,
} from "../utils/reportOptions";
import {
  MIN_DESCRIPTION,
  todayISO,
  type ReportErrors,
  type ReportValues,
} from "../utils/reportForm";

type Props = {
  kind: "lost" | "found";
  values: ReportValues;
  errors: ReportErrors;
  onChange: <K extends keyof ReportValues>(
    field: K,
    value: ReportValues[K],
  ) => void;
};

/** Kolom bersama untuk form kehilangan dan form temuan (info publik). */
export default function ReportFields({ kind, values, errors, onChange }: Props) {
  const lost = kind === "lost";
  const set =
    (field: Exclude<keyof ReportValues, "photos">) =>
    (e: { target: { value: string } }) =>
      onChange(field, e.target.value);

  const item = (
    <>
      <Select
        label={<Req>Kategori Barang</Req>}
        placeholder="Pilih kategori"
        options={CATEGORIES}
        value={values.category}
        onChange={(e) => {
          onChange("category", e.target.value);
          if (e.target.value !== OTHER_CATEGORY) onChange("categoryOther", "");
        }}
        error={errors.category}
      />
      {values.category === OTHER_CATEGORY && (
        <TextField
          label={<Req>Jenis barang</Req>}
          placeholder="Cth: Payung, Kacamata, Helm..."
          maxLength={50}
          value={values.categoryOther}
          onChange={set("categoryOther")}
          error={errors.categoryOther}
        />
      )}
      <TextArea
        label={<Req>{lost ? "Deskripsi Barang" : "Deskripsi Publik"}</Req>}
        hint={
          lost
            ? "Jelaskan barang dengan detail. Hindari menyebutkan informasi pribadi seperti NIM atau nomor KTP."
            : "Deskripsi ini akan ditampilkan di katalog publik. Jangan ungkap ciri rahasia."
        }
        placeholder={
          lost
            ? "Contoh: Tas ransel warna hitam merek Eiger, berisi buku kuliah dan charger laptop..."
            : "Contoh: Dompet kulit warna hitam, ditemukan di dekat pintu masuk Perpustakaan..."
        }
        minChars={MIN_DESCRIPTION}
        value={values.description}
        onChange={set("description")}
        error={errors.description}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Warna"
          placeholder={lost ? "Cth: Hitam, Merah..." : "Cth: Hitam..."}
          value={values.color}
          onChange={set("color")}
        />
        <TextField
          label="Merek"
          placeholder={lost ? "Cth: Eiger, Fossil..." : "Cth: Fossil..."}
          value={values.brand}
          onChange={set("brand")}
        />
      </div>
    </>
  );

  const where = (
    <>
      <TextField
        label={<Req>{lost ? "Lokasi Kejadian" : "Lokasi Penemuan"}</Req>}
        placeholder={
          lost
            ? "Cth: Ruang kuliah FT 301, Parkiran FMIPA..."
            : "Lokasi spesifik tempat barang ditemukan"
        }
        value={values.location}
        onChange={set("location")}
        error={errors.location}
        hint={
          lost
            ? "Isi tempat terakhir barang diketahui masih ada."
            : undefined
        }
      />
      <Select
        label={<Req>{lost ? "Fakultas / Gedung" : "Fakultas / Area Penanganan"}</Req>}
        placeholder={lost ? "Pilih fakultas/gedung" : "Pilih fakultas/area"}
        options={CAMPUS_AREAS}
        value={values.area}
        onChange={set("area")}
        error={errors.area}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={<Req>{lost ? "Tanggal Kejadian" : "Tanggal"}</Req>}
          type="date"
          max={todayISO()}
          value={values.date}
          onChange={set("date")}
          error={errors.date}
        />
        <TextField
          label="Waktu (Opsional)"
          type="time"
          value={values.time}
          onChange={set("time")}
          error={errors.time}
        />
      </div>
    </>
  );

  const photo = (
    <PhotoUpload
      photos={values.photos}
      onChange={(p) => onChange("photos", p)}
      error={errors.photos}
    />
  );

  if (lost) {
    return (
      <>
        <FormSection title="Informasi Barang">{item}</FormSection>
        <FormSection title="Lokasi dan Waktu">{where}</FormSection>
        <FormSection title="Foto (Opsional)">{photo}</FormSection>
      </>
    );
  }

  return (
    <>
      <FormSection
        title={
          <span className="flex items-center gap-2 text-base normal-case tracking-normal">
            <span className="size-2 rounded-full bg-brand-800" />
            Informasi Publik
          </span>
        }
      >
        <Alert>
          Jangan menyebutkan ciri rahasia, kontak pribadi, atau nomor identitas
          di deskripsi publik atau foto.
        </Alert>
        {item}
        {where}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-700">Foto (Opsional)</p>
          {photo}
        </div>
      </FormSection>
    </>
  );
}

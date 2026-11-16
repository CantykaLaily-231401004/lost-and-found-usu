-- Session 4 – Lapor Temuan: skema found_reports mengikuti pola laporan kehilangan (Session 3)
begin;

do $$
begin
  if exists (select 1 from public.found_reports) then
    raise exception 'found_reports sudah berisi data. Migrasi dihentikan, kabari Claude.';
  end if;
end $$;

-- 1. Batas panjang isian (sama dengan lost_reports)
alter table public.found_reports drop constraint found_reports_deskripsi_check;
alter table public.found_reports add constraint found_reports_deskripsi_check
  check (char_length(btrim(deskripsi)) between 20 and 2000);

alter table public.found_reports drop constraint found_reports_warna_check;
alter table public.found_reports add constraint found_reports_warna_check
  check (warna is null or char_length(warna) <= 30);

alter table public.found_reports drop constraint found_reports_merek_check;
alter table public.found_reports add constraint found_reports_merek_check
  check (merek is null or char_length(merek) <= 50);

alter table public.found_reports drop constraint found_reports_lokasi_temuan_check;
alter table public.found_reports add constraint found_reports_lokasi_temuan_check
  check (char_length(btrim(lokasi_temuan)) between 1 and 150);

-- 2. Kategori baku + kategori_lainnya
alter table public.found_reports drop constraint found_reports_kategori_check;
alter table public.found_reports add constraint found_reports_kategori_check
  check (kategori in (
    'Dompet & Tas', 'Dokumen & Kartu', 'Elektronik', 'Kunci', 'Kacamata',
    'Pakaian & Aksesoris', 'Alat Tulis & Buku', 'Botol & Wadah', 'Lainnya'
  ));

alter table public.found_reports add column kategori_lainnya text;
alter table public.found_reports add constraint found_reports_kategori_lainnya_check
  check (
    (kategori = 'Lainnya' and kategori_lainnya is not null
      and char_length(btrim(kategori_lainnya)) between 3 and 50)
    or (kategori <> 'Lainnya' and kategori_lainnya is null)
  );

-- 3. Tanggal dan jam terpisah dalam WIB.
-- Aturan "tidak boleh di masa depan" memakai ulang public.waktu_kejadian_valid (Session 3),
-- dipanggil dari RPC temuan di migrasi berikutnya.
-- Kedua policy di bawah memakai kolom tanggal_temuan, jadi harus dilepas sebelum tipenya diubah.
-- Keduanya TIDAK dibuat lagi: penulisan temuan hanya lewat RPC (keputusan 7).
--   found_insert       : tidak pernah terpakai (tidak ada GRANT INSERT)
--   found_update_owner : digantikan rpc_update_found_report
drop policy found_insert on public.found_reports;
drop policy found_update_owner on public.found_reports;

alter table public.found_reports
  alter column tanggal_temuan type date
  using (tanggal_temuan at time zone 'Asia/Jakarta')::date;
alter table public.found_reports add column jam_temuan time;

-- 4. Kode laporan TEM-YYYY-NNNNN, dibuat database dan tidak bisa diisi user
create sequence if not exists public.found_reports_kode_seq;

alter table public.found_reports add column kode text;

create or replace function public.set_found_report_kode()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_no text := nextval('public.found_reports_kode_seq')::text;
begin
  new.kode := 'TEM-'
    || to_char(now() at time zone 'Asia/Jakarta', 'YYYY')
    || '-' || lpad(v_no, greatest(5, char_length(v_no)), '0');
  return new;
end;
$$;

create trigger set_kode
  before insert on public.found_reports
  for each row execute function public.set_found_report_kode();

alter table public.found_reports alter column kode set not null;
alter table public.found_reports add constraint found_reports_kode_key unique (kode);

-- 5. Hak akses
-- Ubah langsung lewat API dicabut (pasangan dari policy found_update_owner yang dihapus di atas).
revoke update on table public.found_reports from authenticated;

-- Sequence kode hanya dipakai trigger.
revoke all on sequence public.found_reports_kode_seq from public, anon, authenticated;

-- Fungsi trigger kode tidak boleh dipanggil siapa pun secara langsung.
revoke all on function public.set_found_report_kode() from public, anon, authenticated;

commit;
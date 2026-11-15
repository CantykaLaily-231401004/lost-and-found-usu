begin;

do $$
begin
  if exists (select 1 from public.lost_reports) then
    raise exception 'lost_reports sudah berisi data. Migrasi dihentikan, kabari Claude.';
  end if;
end $$;

-- 1. areas: hapus kolom fakultas_id (duplikat informasi), lalu isi 17 area
alter table public.areas drop constraint if exists areas_fakultas_check;
alter table public.areas drop column if exists fakultas_id;

insert into public.areas (nama_area, jenis_area) values
  ('Area Umum Kampus',              'umum'),
  ('Fakultas Hukum',                'fakultas'),
  ('Fakultas Teknik',               'fakultas'),
  ('Fakultas Kedokteran',           'fakultas'),
  ('Fakultas Pertanian',            'fakultas'),
  ('Fakultas Ekonomi dan Bisnis',   'fakultas'),
  ('Fakultas Kedokteran Gigi',      'fakultas'),
  ('FISIP',                         'fakultas'),
  ('Fakultas Ilmu Budaya',          'fakultas'),
  ('FMIPA',                         'fakultas'),
  ('Fakultas Farmasi',              'fakultas'),
  ('Fakultas Kesehatan Masyarakat', 'fakultas'),
  ('Fakultas Psikologi',            'fakultas'),
  ('Fasilkom-TI',                   'fakultas'),
  ('Fakultas Keperawatan',          'fakultas'),
  ('Fakultas Kehutanan',            'fakultas'),
  ('Fakultas Vokasi',               'fakultas')
on conflict do nothing;

-- 2. Batas panjang isian (A1, A2)
alter table public.lost_reports drop constraint lost_reports_deskripsi_check;
alter table public.lost_reports add constraint lost_reports_deskripsi_check
  check (char_length(btrim(deskripsi)) between 20 and 2000);

alter table public.lost_reports drop constraint lost_reports_warna_check;
alter table public.lost_reports add constraint lost_reports_warna_check
  check (warna is null or char_length(warna) <= 30);

alter table public.lost_reports drop constraint lost_reports_merek_check;
alter table public.lost_reports add constraint lost_reports_merek_check
  check (merek is null or char_length(merek) <= 50);

alter table public.lost_reports drop constraint lost_reports_lokasi_kehilangan_check;
alter table public.lost_reports add constraint lost_reports_lokasi_kehilangan_check
  check (char_length(btrim(lokasi_kehilangan)) between 1 and 150);

-- 3. Kategori baku + kategori_lainnya (B1)
alter table public.lost_reports drop constraint lost_reports_kategori_check;
alter table public.lost_reports add constraint lost_reports_kategori_check
  check (kategori in (
    'Dompet & Tas', 'Dokumen & Kartu', 'Elektronik', 'Kunci', 'Kacamata',
    'Pakaian & Aksesoris', 'Alat Tulis & Buku', 'Botol & Wadah', 'Lainnya'
  ));

alter table public.lost_reports add column kategori_lainnya text;
alter table public.lost_reports add constraint lost_reports_kategori_lainnya_check
  check (
    (kategori = 'Lainnya' and kategori_lainnya is not null
      and char_length(btrim(kategori_lainnya)) between 3 and 50)
    or (kategori <> 'Lainnya' and kategori_lainnya is null)
  );

-- 4. Tanggal dan jam terpisah, dihitung dalam WIB (B3)
-- Fungsi bantu: true kalau tanggal (+ jam bila diisi) tidak melewati waktu sekarang di WIB.
create or replace function public.waktu_kejadian_valid(p_tanggal date, p_jam time)
returns boolean
language sql
stable
set search_path to ''
as $$
  select p_tanggal is not null
     and p_tanggal <= (now() at time zone 'Asia/Jakarta')::date
     and (p_jam is null or (p_tanggal + p_jam) <= (now() at time zone 'Asia/Jakarta'));
$$;

-- Policy lama memakai kolom tanggal_kehilangan, jadi harus dilepas dulu sebelum tipenya diubah
drop policy lost_insert on public.lost_reports;
drop policy lost_update_owner on public.lost_reports;

alter table public.lost_reports
  alter column tanggal_kehilangan type date
  using (tanggal_kehilangan at time zone 'Asia/Jakarta')::date;
alter table public.lost_reports add column jam_kehilangan time;

-- Policy dibuat lagi, isinya sama seperti sebelumnya, hanya aturan waktunya yang baru
create policy lost_insert on public.lost_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_verified()
    and public.waktu_kejadian_valid(tanggal_kehilangan, jam_kehilangan)
  );

create policy lost_update_owner on public.lost_reports
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'aktif')
  with check (
    user_id = (select auth.uid())
    and public.waktu_kejadian_valid(tanggal_kehilangan, jam_kehilangan)
  );

-- 5. Kode laporan KEH-YYYY-NNNNN (B4), dibuat database dan tidak bisa diisi user
create sequence if not exists public.lost_reports_kode_seq;

alter table public.lost_reports add column kode text;

create or replace function public.set_lost_report_kode()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_no text := nextval('public.lost_reports_kode_seq')::text;
begin
  new.kode := 'KEH-'
    || to_char(now() at time zone 'Asia/Jakarta', 'YYYY')
    || '-' || lpad(v_no, greatest(5, char_length(v_no)), '0');
  return new;
end;
$$;

create trigger set_kode
  before insert on public.lost_reports
  for each row execute function public.set_lost_report_kode();

alter table public.lost_reports alter column kode set not null;
alter table public.lost_reports add constraint lost_reports_kode_key unique (kode);

-- 6. Hak akses objek baru (default Supabase memberi hak penuh ke anon & authenticated)
-- Sequence kode hanya dipakai trigger; tidak ada user yang boleh memakainya langsung.
revoke all on sequence public.lost_reports_kode_seq from public, anon, authenticated;

-- Fungsi waktu dipakai policy, jadi authenticated perlu EXECUTE; anon tidak.
revoke all on function public.waktu_kejadian_valid(date, time) from public, anon, authenticated;
grant execute on function public.waktu_kejadian_valid(date, time) to authenticated;

-- Fungsi trigger kode tidak boleh dipanggil siapa pun secara langsung.
revoke all on function public.set_lost_report_kode() from public, anon, authenticated;

commit;
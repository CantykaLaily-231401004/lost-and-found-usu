begin;

create or replace function public.lost_report_input_error(
  p_kategori         text,
  p_kategori_lainnya text,
  p_deskripsi        text,
  p_warna            text,
  p_merek            text,
  p_lokasi           text,
  p_area_id          uuid,
  p_tanggal          date,
  p_jam              time
)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
begin
  if p_kategori is null or p_kategori not in (
       'Dompet & Tas', 'Dokumen & Kartu', 'Elektronik', 'Kunci', 'Kacamata',
       'Pakaian & Aksesoris', 'Alat Tulis & Buku', 'Botol & Wadah', 'Lainnya') then
    return public.rpc_field_error('kategori', 'Pilih kategori barang dari daftar.');
  end if;
  if p_kategori = 'Lainnya'
     and (p_kategori_lainnya is null or char_length(p_kategori_lainnya) not between 3 and 50) then
    return public.rpc_field_error('kategori_lainnya', 'Sebutkan jenis barangnya, 3 sampai 50 karakter.');
  end if;
  if p_deskripsi is null or char_length(p_deskripsi) not between 20 and 2000 then
    return public.rpc_field_error('deskripsi', 'Deskripsi wajib diisi, 20 sampai 2000 karakter.');
  end if;
  if p_warna is not null and char_length(p_warna) > 30 then
    return public.rpc_field_error('warna', 'Warna maksimal 30 karakter.');
  end if;
  if p_merek is not null and char_length(p_merek) > 50 then
    return public.rpc_field_error('merek', 'Merek maksimal 50 karakter.');
  end if;
  if p_lokasi is null or char_length(p_lokasi) not between 1 and 150 then
    return public.rpc_field_error('lokasi_kehilangan', 'Lokasi kejadian wajib diisi, maksimal 150 karakter.');
  end if;
  if p_area_id is null or not exists (select 1 from public.areas where area_id = p_area_id) then
    return public.rpc_field_error('area_id', 'Pilih area kampus dari daftar.');
  end if;
  if p_tanggal is null then
    return public.rpc_field_error('tanggal_kehilangan', 'Tanggal kehilangan wajib diisi.');
  end if;
  if not public.waktu_kejadian_valid(p_tanggal, null) then
    return public.rpc_field_error('tanggal_kehilangan', 'Tanggal kehilangan tidak boleh di masa depan.');
  end if;
  if not public.waktu_kejadian_valid(p_tanggal, p_jam) then
    return public.rpc_field_error('jam_kehilangan', 'Waktu kehilangan tidak boleh melewati waktu saat ini.');
  end if;
  return null;
end;
$$;

-- 1b. Validasi path foto baru: harus di folder yang ditentukan dan sudah ada di Storage.
create or replace function public.report_photo_paths_error(p_paths text[], p_prefix text)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select case
    when exists (select 1 from unnest(p_paths) as t(p)
                 where left(t.p, char_length(p_prefix)) <> p_prefix)
      then public.rpc_field_error('photos', 'Lokasi foto tidak valid. Unggah ulang foto.')
    when exists (select 1 from unnest(p_paths) as t(p)
                 where not exists (select 1 from storage.objects o
                                   where o.bucket_id = 'report-photos' and o.name = t.p))
      then public.rpc_field_error('photos', 'Ada foto yang belum terunggah. Unggah ulang atau kirim tanpa foto.')
  end;
$$;

-- 2. rpc_create_lost_report: parameter dan perilaku sama dengan file 02, validasi dipindah ke fungsi bersama
create or replace function public.rpc_create_lost_report(
  p_client_request_id  uuid,
  p_area_id            uuid,
  p_kategori           text,
  p_deskripsi          text,
  p_lokasi_kehilangan  text,
  p_tanggal_kehilangan date,
  p_kategori_lainnya   text   default null,
  p_jam_kehilangan     time   default null,
  p_warna              text   default null,
  p_merek              text   default null,
  p_photo_paths        text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_kategori  text := btrim(coalesce(p_kategori, ''));
  v_lainnya   text := nullif(btrim(coalesce(p_kategori_lainnya, '')), '');
  v_deskripsi text := btrim(coalesce(p_deskripsi, ''));
  v_lokasi    text := btrim(coalesce(p_lokasi_kehilangan, ''));
  v_warna     text := nullif(btrim(coalesce(p_warna, '')), '');
  v_merek     text := nullif(btrim(coalesce(p_merek, '')), '');
  v_paths     text[];
  v_err       jsonb;
  v_lost      record;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi. Verifikasi surel terlebih dahulu.');
  end if;
  if p_client_request_id is null then
    return public.rpc_error('VALIDATION', 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.');
  end if;

  -- Kiriman ulang dengan kunci yang sama: kembalikan laporan yang sudah tersimpan (FR-07)
  select lost_id, kode, status into v_lost
  from public.lost_reports
  where user_id = v_uid and client_request_id = p_client_request_id;
  if found then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'lost_id', v_lost.lost_id, 'kode', v_lost.kode, 'status', v_lost.status, 'duplikat', true));
  end if;

  v_err := public.lost_report_input_error(v_kategori, v_lainnya, v_deskripsi, v_warna, v_merek,
                                          v_lokasi, p_area_id, p_tanggal_kehilangan, p_jam_kehilangan);
  if v_err is not null then
    return v_err;
  end if;
  if v_kategori <> 'Lainnya' then
    v_lainnya := null;
  end if;

  -- Foto: maks 3, di folder {uid}/{client_request_id}/
  v_paths := array(
    select distinct btrim(x) from unnest(coalesce(p_photo_paths, '{}'::text[])) as t(x)
    where btrim(x) <> ''
  );
  if cardinality(v_paths) > 3 then
    return public.rpc_field_error('photos', 'Maksimal 3 foto per laporan.');
  end if;
  v_err := public.report_photo_paths_error(v_paths, v_uid::text || '/' || p_client_request_id::text || '/');
  if v_err is not null then
    return v_err;
  end if;

  begin
    insert into public.lost_reports (
      user_id, area_id, client_request_id, kategori, kategori_lainnya, deskripsi,
      warna, merek, lokasi_kehilangan, tanggal_kehilangan, jam_kehilangan
    )
    values (
      v_uid, p_area_id, p_client_request_id, v_kategori, v_lainnya, v_deskripsi,
      v_warna, v_merek, v_lokasi, p_tanggal_kehilangan, p_jam_kehilangan
    )
    returning lost_id, kode into v_lost;

    insert into public.photos (lost_id, storage_path)
    select v_lost.lost_id, t.p from unnest(v_paths) as t(p);
  exception
    when unique_violation then
      select lost_id, kode, status into v_lost
      from public.lost_reports
      where user_id = v_uid and client_request_id = p_client_request_id;
      if found then
        return jsonb_build_object('ok', true, 'data', jsonb_build_object(
          'lost_id', v_lost.lost_id, 'kode', v_lost.kode, 'status', v_lost.status, 'duplikat', true));
      end if;
      return public.rpc_error('CONFLICT', 'Pengiriman bersamaan terdeteksi. Muat ulang dan periksa Laporan Saya.');
    when check_violation then
      return public.rpc_error('VALIDATION', 'Periksa kembali isian laporan.');
  end;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'lost_id', v_lost.lost_id, 'kode', v_lost.kode, 'status', 'aktif',
    'duplikat', false, 'jumlah_foto', cardinality(v_paths)));
end;
$$;

-- 3. rpc_update_lost_report: hanya pelapor, hanya saat aktif; admin tidak berwenang (SRS 3.2 aturan 10)
create or replace function public.rpc_update_lost_report(
  p_lost_id            uuid,
  p_area_id            uuid,
  p_kategori           text,
  p_deskripsi          text,
  p_lokasi_kehilangan  text,
  p_tanggal_kehilangan date,
  p_kategori_lainnya   text   default null,
  p_jam_kehilangan     time   default null,
  p_warna              text   default null,
  p_merek              text   default null,
  p_foto_baru          text[] default '{}',
  p_foto_hapus         uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_kategori  text := btrim(coalesce(p_kategori, ''));
  v_lainnya   text := nullif(btrim(coalesce(p_kategori_lainnya, '')), '');
  v_deskripsi text := btrim(coalesce(p_deskripsi, ''));
  v_lokasi    text := btrim(coalesce(p_lokasi_kehilangan, ''));
  v_warna     text := nullif(btrim(coalesce(p_warna, '')), '');
  v_merek     text := nullif(btrim(coalesce(p_merek, '')), '');
  v_old       public.lost_reports%rowtype;
  v_baru      text[];
  v_hapus     uuid[];
  v_err       jsonb;
  v_ubah      text[];
  v_dihapus   text[];
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  select * into v_old from public.lost_reports where lost_id = p_lost_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Laporan kehilangan tidak ditemukan.');
  end if;
  if v_old.user_id <> v_uid then
    return public.rpc_error('FORBIDDEN', 'Hanya pelapor yang dapat mengubah laporan kehilangan ini.');
  end if;
  if v_old.status <> 'aktif' then
    return public.rpc_error('CONFLICT', 'Laporan sudah ditutup dan tidak dapat diubah.');
  end if;

  v_err := public.lost_report_input_error(v_kategori, v_lainnya, v_deskripsi, v_warna, v_merek,
                                          v_lokasi, p_area_id, p_tanggal_kehilangan, p_jam_kehilangan);
  if v_err is not null then
    return v_err;
  end if;
  if v_kategori <> 'Lainnya' then
    v_lainnya := null;
  end if;

  -- Foto: hapus yang dipilih, tambah yang baru di folder {uid}/{lost_id}/, total maks 3
  v_baru := array(
    select distinct btrim(x) from unnest(coalesce(p_foto_baru, '{}'::text[])) as t(x)
    where btrim(x) <> ''
  );
  v_hapus := array(
    select distinct x from unnest(coalesce(p_foto_hapus, '{}'::uuid[])) as t(x)
    where x is not null
  );
  if (select count(*) from public.photos where lost_id = p_lost_id and photo_id = any(v_hapus))
     <> cardinality(v_hapus) then
    return public.rpc_field_error('photos', 'Foto yang akan dihapus tidak ditemukan pada laporan ini.');
  end if;
  v_err := public.report_photo_paths_error(v_baru, v_uid::text || '/' || p_lost_id::text || '/');
  if v_err is not null then
    return v_err;
  end if;
  if exists (select 1 from public.photos where lost_id = p_lost_id and storage_path = any(v_baru)) then
    return public.rpc_field_error('photos', 'Foto tersebut sudah ada di laporan ini.');
  end if;
  if (select count(*) from public.photos where lost_id = p_lost_id)
     - cardinality(v_hapus) + cardinality(v_baru) > 3 then
    return public.rpc_field_error('photos', 'Maksimal 3 foto per laporan.');
  end if;

  -- Kolom yang berubah, untuk audit. Tidak ada perubahan berarti tidak ada audit.
  v_ubah := array_remove(array[
    case when v_old.kategori           is distinct from v_kategori           then 'kategori' end,
    case when v_old.kategori_lainnya   is distinct from v_lainnya            then 'jenis barang' end,
    case when v_old.deskripsi          is distinct from v_deskripsi          then 'deskripsi' end,
    case when v_old.warna              is distinct from v_warna              then 'warna' end,
    case when v_old.merek              is distinct from v_merek              then 'merek' end,
    case when v_old.lokasi_kehilangan  is distinct from v_lokasi             then 'lokasi' end,
    case when v_old.area_id            is distinct from p_area_id            then 'area' end,
    case when v_old.tanggal_kehilangan is distinct from p_tanggal_kehilangan then 'tanggal' end,
    case when v_old.jam_kehilangan     is distinct from p_jam_kehilangan     then 'jam' end,
    case when cardinality(v_baru) + cardinality(v_hapus) > 0                then 'foto' end
  ], null);

  if cardinality(v_ubah) = 0 then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'lost_id', p_lost_id, 'kode', v_old.kode, 'status', v_old.status,
      'berubah', false, 'kolom_diubah', '[]'::jsonb, 'foto_dihapus', '[]'::jsonb));
  end if;

  update public.lost_reports set
    area_id            = p_area_id,
    kategori           = v_kategori,
    kategori_lainnya   = v_lainnya,
    deskripsi          = v_deskripsi,
    warna              = v_warna,
    merek              = v_merek,
    lokasi_kehilangan  = v_lokasi,
    tanggal_kehilangan = p_tanggal_kehilangan,
    jam_kehilangan     = p_jam_kehilangan
  where lost_id = p_lost_id;

  with d as (
    delete from public.photos
    where lost_id = p_lost_id and photo_id = any(v_hapus)
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_dihapus from d;

  insert into public.photos (lost_id, storage_path)
  select p_lost_id, t.p from unnest(v_baru) as t(p);

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'lost_report', p_lost_id, 'kehilangan_diubah',
          'Kolom diubah: ' || array_to_string(v_ubah, ', '));

  -- foto_dihapus dikembalikan supaya frontend menghapus berkasnya dari Storage
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'lost_id', p_lost_id, 'kode', v_old.kode, 'status', 'aktif',
    'berubah', true, 'kolom_diubah', to_jsonb(v_ubah), 'foto_dihapus', to_jsonb(v_dihapus)));
exception
  when check_violation then
    return public.rpc_error('VALIDATION', 'Periksa kembali isian laporan.');
end;
$$;

-- 4. rpc_close_lost_report: sama dengan baseline, hanya batas alasan 3-1000 -> 10-300
create or replace function public.rpc_close_lost_report(p_lost_id uuid, p_alasan text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_alasan text := btrim(coalesce(p_alasan, ''));
  v_lost   public.lost_reports%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_lost_id is null or char_length(v_alasan) not between 10 and 300 then
    return public.rpc_error('VALIDATION', 'Alasan penutupan wajib diisi, 10 sampai 300 karakter.');
  end if;

  select * into v_lost from public.lost_reports where lost_id = p_lost_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Laporan kehilangan tidak ditemukan.');
  end if;
  if v_lost.user_id <> v_uid then
    return public.rpc_error('FORBIDDEN', 'Hanya pemilik laporan yang dapat menutup laporan kehilangan.');
  end if;
  if v_lost.status <> 'aktif' then
    return public.rpc_error('CONFLICT', 'Laporan ini sudah ditutup.');
  end if;

  update public.lost_reports set status = 'ditutup' where lost_id = p_lost_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'lost_report', p_lost_id, 'kehilangan_ditutup', v_alasan);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'lost_id', p_lost_id, 'status', 'ditutup'));
end;
$$;

-- 5. Riwayat semua laporan kehilangan milik pemanggil, dalam satu panggilan.
--    audit_records tetap tertutup untuk user (audit_select hanya admin pusat); RPC ini
--    hanya mengembalikan catatan atas laporan milik pemanggil.
create or replace function public.rpc_get_my_lost_report_history()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
             'lost_id', r.lost_id, 'kode', r.kode, 'aksi', r.aksi, 'waktu', r.waktu, 'alasan', r.alasan)
           order by r.waktu desc)
    from (
      select l.lost_id, l.kode, 'dibuat'::text as aksi, l.created_at as waktu, null::text as alasan
      from public.lost_reports l
      where l.user_id = v_uid
      union all
      select l.lost_id, l.kode,
             case a.action when 'kehilangan_diubah' then 'diubah'
                           when 'kehilangan_ditutup' then 'ditutup'
                           else a.action end,
             a.occurred_at, a.alasan
      from public.audit_records a
      join public.lost_reports l on l.lost_id = a.object_id
      where a.object_type = 'lost_report' and l.user_id = v_uid
    ) r
  ), '[]'::jsonb));
end;
$$;

-- 6. Tutup jalur tulis langsung lewat API.
--    6a. lost_reports: cabut hak INSERT/UPDATE dari user; policy yang tidak terpakai dihapus.
revoke insert, update on table public.lost_reports from authenticated;
drop policy if exists lost_insert on public.lost_reports;
drop policy if exists lost_update_owner on public.lost_reports;

--    6b. photos: user hanya boleh menambah/menghapus foto laporan TEMUAN secara langsung
--        (Session 4 akan menyesuaikan). Foto laporan kehilangan hanya lewat RPC.
drop policy photos_insert on public.photos;
create policy photos_insert on public.photos
  for insert to authenticated
  with check (
    storage_path like ((select auth.uid())::text || '/%')
    and found_id is not null
    and exists (select 1 from public.found_reports f
                where f.found_id = photos.found_id and f.user_id = (select auth.uid()))
  );

drop policy photos_delete on public.photos;
create policy photos_delete on public.photos
  for delete to authenticated
  using (
    found_id is not null
    and exists (select 1 from public.found_reports f
                where f.found_id = photos.found_id and f.user_id = (select auth.uid()))
  );

-- 7. Hak akses fungsi baru. rpc_create dan rpc_close mempertahankan hak lamanya
--    (create or replace tidak mengubah GRANT).
revoke all on function public.lost_report_input_error(text, text, text, text, text, text, uuid, date, time)
  from public, anon, authenticated;
revoke all on function public.report_photo_paths_error(text[], text) from public, anon, authenticated;

revoke all on function public.rpc_update_lost_report(uuid, uuid, text, text, text, date, text, time, text, text, text[], uuid[])
  from public, anon, authenticated;
grant execute on function public.rpc_update_lost_report(uuid, uuid, text, text, text, date, text, time, text, text, text[], uuid[])
  to authenticated;

revoke all on function public.rpc_get_my_lost_report_history() from public, anon, authenticated;
grant execute on function public.rpc_get_my_lost_report_history() to authenticated;

commit;
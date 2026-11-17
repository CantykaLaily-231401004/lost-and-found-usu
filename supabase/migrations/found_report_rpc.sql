begin;

create or replace function public.found_report_input_error(
  p_kategori         text,
  p_kategori_lainnya text,
  p_deskripsi        text,
  p_warna            text,
  p_merek            text,
  p_lokasi           text,
  p_area_id          uuid,
  p_tanggal          date,
  p_jam              time,
  p_ciri             text[]
)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_no int;
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
    return public.rpc_field_error('lokasi_temuan', 'Lokasi penemuan wajib diisi, maksimal 150 karakter.');
  end if;
  if p_area_id is null or not exists (select 1 from public.areas where area_id = p_area_id) then
    return public.rpc_field_error('area_id', 'Pilih area kampus dari daftar.');
  end if;
  if p_tanggal is null then
    return public.rpc_field_error('tanggal_temuan', 'Tanggal penemuan wajib diisi.');
  end if;
  if not public.waktu_kejadian_valid(p_tanggal, null) then
    return public.rpc_field_error('tanggal_temuan', 'Tanggal penemuan tidak boleh di masa depan.');
  end if;
  if not public.waktu_kejadian_valid(p_tanggal, p_jam) then
    return public.rpc_field_error('jam_temuan', 'Waktu penemuan tidak boleh melewati waktu saat ini.');
  end if;

  if p_ciri is null or cardinality(p_ciri) = 0 then
    return public.rpc_field_error('ciri_rahasia', 'Isi minimal satu ciri rahasia.');
  end if;
  if cardinality(p_ciri) > 5 then
    return public.rpc_field_error('ciri_rahasia', 'Ciri rahasia maksimal 5.');
  end if;
  select t.n into v_no
  from unnest(p_ciri) with ordinality as t(x, n)
  where char_length(t.x) not between 3 and 500
  order by t.n
  limit 1;
  if v_no is not null then
    return public.rpc_field_error('ciri_rahasia',
      'Ciri rahasia ke-' || v_no || ' harus 3 sampai 500 karakter.');
  end if;
  return null;
end;
$$;

drop function public.rpc_create_found_report(
  uuid, text, text, text, timestamp with time zone, text[], text, text, uuid);

create function public.rpc_create_found_report(
  p_client_request_id uuid,
  p_area_id           uuid,
  p_kategori          text,
  p_deskripsi         text,
  p_lokasi_temuan     text,
  p_tanggal_temuan    date,
  p_ciri_rahasia      text[],
  p_kategori_lainnya  text   default null,
  p_jam_temuan        time   default null,
  p_warna             text   default null,
  p_merek             text   default null,
  p_photo_paths       text[] default '{}'
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
  v_lokasi    text := btrim(coalesce(p_lokasi_temuan, ''));
  v_warna     text := nullif(btrim(coalesce(p_warna, '')), '');
  v_merek     text := nullif(btrim(coalesce(p_merek, '')), '');
  v_ciri      text[];
  v_paths     text[];
  v_err       jsonb;
  v_found     record;
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

  select found_id, kode, status into v_found
  from public.found_reports
  where user_id = v_uid and client_request_id = p_client_request_id;
  if found then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'found_id', v_found.found_id, 'kode', v_found.kode, 'status', v_found.status, 'duplikat', true));
  end if;

  v_ciri := array(
    select btrim(t.x) from unnest(coalesce(p_ciri_rahasia, '{}'::text[])) with ordinality as t(x, n)
    where btrim(coalesce(t.x, '')) <> ''
    order by t.n
  );

  v_err := public.found_report_input_error(v_kategori, v_lainnya, v_deskripsi, v_warna, v_merek,
                                           v_lokasi, p_area_id, p_tanggal_temuan, p_jam_temuan, v_ciri);
  if v_err is not null then
    return v_err;
  end if;
  if v_kategori <> 'Lainnya' then
    v_lainnya := null;
  end if;

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
    insert into public.found_reports (
      user_id, area_id, client_request_id, kategori, kategori_lainnya, deskripsi,
      warna, merek, lokasi_temuan, tanggal_temuan, jam_temuan
    )
    values (
      v_uid, p_area_id, p_client_request_id, v_kategori, v_lainnya, v_deskripsi,
      v_warna, v_merek, v_lokasi, p_tanggal_temuan, p_jam_temuan
    )
    returning found_id, kode into v_found;

    insert into public.data_rahasia (found_id, ciri_rahasia)
    values (v_found.found_id, v_ciri);

    insert into public.photos (found_id, storage_path)
    select v_found.found_id, t.p from unnest(v_paths) as t(p);
  exception
    when unique_violation then
      select found_id, kode, status into v_found
      from public.found_reports
      where user_id = v_uid and client_request_id = p_client_request_id;
      if found then
        return jsonb_build_object('ok', true, 'data', jsonb_build_object(
          'found_id', v_found.found_id, 'kode', v_found.kode, 'status', v_found.status, 'duplikat', true));
      end if;
      return public.rpc_error('CONFLICT', 'Pengiriman bersamaan terdeteksi. Muat ulang dan periksa Laporan Saya.');
    when check_violation then
      return public.rpc_error('VALIDATION', 'Periksa kembali isian laporan.');
  end;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', v_found.found_id, 'kode', v_found.kode, 'status', 'tersedia',
    'duplikat', false, 'jumlah_foto', cardinality(v_paths)));
end;
$$;

create or replace function public.rpc_update_found_report(
  p_found_id          uuid,
  p_area_id           uuid,
  p_kategori          text,
  p_deskripsi         text,
  p_lokasi_temuan     text,
  p_tanggal_temuan    date,
  p_ciri_rahasia      text[],
  p_kategori_lainnya  text   default null,
  p_jam_temuan        time   default null,
  p_warna             text   default null,
  p_merek             text   default null,
  p_foto_baru         text[] default '{}',
  p_foto_hapus        uuid[] default '{}'
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
  v_lokasi    text := btrim(coalesce(p_lokasi_temuan, ''));
  v_warna     text := nullif(btrim(coalesce(p_warna, '')), '');
  v_merek     text := nullif(btrim(coalesce(p_merek, '')), '');
  v_old       public.found_reports%rowtype;
  v_old_ciri  text[];
  v_ciri      text[];
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

  select * into v_old from public.found_reports where found_id = p_found_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Laporan temuan tidak ditemukan.');
  end if;
  if v_old.user_id <> v_uid then
    return public.rpc_error('FORBIDDEN', 'Hanya pelapor yang dapat mengubah laporan temuan ini.');
  end if;
  if v_old.status <> 'tersedia' then
    return public.rpc_error('CONFLICT', 'Laporan sudah dicadangkan, diserahkan, atau ditutup sehingga tidak dapat diubah.');
  end if;
  if public.has_active_claim(p_found_id) then
    return public.rpc_error('CONFLICT', 'Laporan ini memiliki klaim aktif. Perubahan hanya dapat dilakukan melalui admin. Muat ulang halaman.');
  end if;

  v_ciri := array(
    select btrim(t.x) from unnest(coalesce(p_ciri_rahasia, '{}'::text[])) with ordinality as t(x, n)
    where btrim(coalesce(t.x, '')) <> ''
    order by t.n
  );

  v_err := public.found_report_input_error(v_kategori, v_lainnya, v_deskripsi, v_warna, v_merek,
                                           v_lokasi, p_area_id, p_tanggal_temuan, p_jam_temuan, v_ciri);
  if v_err is not null then
    return v_err;
  end if;
  if v_kategori <> 'Lainnya' then
    v_lainnya := null;
  end if;

  v_baru := array(
    select distinct btrim(x) from unnest(coalesce(p_foto_baru, '{}'::text[])) as t(x)
    where btrim(x) <> ''
  );
  v_hapus := array(
    select distinct x from unnest(coalesce(p_foto_hapus, '{}'::uuid[])) as t(x)
    where x is not null
  );
  if (select count(*) from public.photos where found_id = p_found_id and photo_id = any(v_hapus))
     <> cardinality(v_hapus) then
    return public.rpc_field_error('photos', 'Foto yang akan dihapus tidak ditemukan pada laporan ini.');
  end if;
  v_err := public.report_photo_paths_error(v_baru, v_uid::text || '/' || p_found_id::text || '/');
  if v_err is not null then
    return v_err;
  end if;
  if exists (select 1 from public.photos where found_id = p_found_id and storage_path = any(v_baru)) then
    return public.rpc_field_error('photos', 'Foto tersebut sudah ada di laporan ini.');
  end if;
  if (select count(*) from public.photos where found_id = p_found_id)
     - cardinality(v_hapus) + cardinality(v_baru) > 3 then
    return public.rpc_field_error('photos', 'Maksimal 3 foto per laporan.');
  end if;

  select ciri_rahasia into v_old_ciri from public.data_rahasia where found_id = p_found_id;

  v_ubah := array_remove(array[
    case when v_old.kategori         is distinct from v_kategori        then 'kategori' end,
    case when v_old.kategori_lainnya is distinct from v_lainnya         then 'jenis barang' end,
    case when v_old.deskripsi        is distinct from v_deskripsi       then 'deskripsi' end,
    case when v_old.warna            is distinct from v_warna           then 'warna' end,
    case when v_old.merek            is distinct from v_merek           then 'merek' end,
    case when v_old.lokasi_temuan    is distinct from v_lokasi          then 'lokasi' end,
    case when v_old.area_id          is distinct from p_area_id         then 'area' end,
    case when v_old.tanggal_temuan   is distinct from p_tanggal_temuan  then 'tanggal' end,
    case when v_old.jam_temuan       is distinct from p_jam_temuan      then 'jam' end,
    case when v_old_ciri             is distinct from v_ciri            then 'ciri rahasia' end,
    case when cardinality(v_baru) + cardinality(v_hapus) > 0            then 'foto' end
  ], null);

  if cardinality(v_ubah) = 0 then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'found_id', p_found_id, 'kode', v_old.kode, 'status', v_old.status,
      'berubah', false, 'kolom_diubah', '[]'::jsonb, 'foto_dihapus', '[]'::jsonb));
  end if;

  update public.found_reports set
    area_id          = p_area_id,
    kategori         = v_kategori,
    kategori_lainnya = v_lainnya,
    deskripsi        = v_deskripsi,
    warna            = v_warna,
    merek            = v_merek,
    lokasi_temuan    = v_lokasi,
    tanggal_temuan   = p_tanggal_temuan,
    jam_temuan       = p_jam_temuan
  where found_id = p_found_id;

  if v_old_ciri is distinct from v_ciri then
    update public.data_rahasia set ciri_rahasia = v_ciri where found_id = p_found_id;
  end if;

  with d as (
    delete from public.photos
    where found_id = p_found_id and photo_id = any(v_hapus)
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_dihapus from d;

  insert into public.photos (found_id, storage_path)
  select p_found_id, t.p from unnest(v_baru) as t(p);

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', p_found_id, 'temuan_diubah',
          'Kolom diubah: ' || array_to_string(v_ubah, ', '));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', p_found_id, 'kode', v_old.kode, 'status', 'tersedia',
    'berubah', true, 'kolom_diubah', to_jsonb(v_ubah), 'foto_dihapus', to_jsonb(v_dihapus)));
exception
  when check_violation then
    return public.rpc_error('VALIDATION', 'Periksa kembali isian laporan.');
end;
$$;

CREATE OR REPLACE FUNCTION public.rpc_close_found_report(p_found_id uuid, p_alasan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid      uuid := (select auth.uid());
  v_alasan   text := btrim(coalesce(p_alasan, ''));
  v_found    public.found_reports%rowtype;
  v_is_owner boolean;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_found_id is null or char_length(v_alasan) not between 10 and 300 then
    return public.rpc_error('VALIDATION', 'Alasan penutupan wajib diisi, 10 sampai 300 karakter.');
  end if;

  select * into v_found from public.found_reports where found_id = p_found_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Laporan temuan tidak ditemukan.');
  end if;

  v_is_owner := (v_found.user_id = v_uid);

  if not v_is_owner and not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang menutup laporan ini.');
  end if;
  if v_found.status = 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Temuan ini memiliki klaim yang disetujui. Batalkan klaim atau selesaikan serah terima terlebih dahulu.');
  end if;
  if v_found.status <> 'tersedia' then
    return public.rpc_error('CONFLICT', 'Laporan ini sudah diserahkan atau ditutup.');
  end if;
  if public.has_active_claim(p_found_id) then
    return public.rpc_error('CONFLICT', 'Masih ada klaim yang menunggu. Tolak atau batalkan klaim tersebut terlebih dahulu.');
  end if;

  update public.found_reports set status = 'ditutup' where found_id = p_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', p_found_id, 'temuan_ditutup', v_alasan);

  if not v_is_owner then
    perform public.internal_notify(
      v_found.user_id, 'status_temuan',
      'Laporan temuan Anda ' || v_found.kode || ' ditutup oleh admin.'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', p_found_id, 'status', 'ditutup'));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_get_my_found_report_history()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
             'found_id', r.found_id, 'kode', r.kode, 'aksi', r.aksi, 'waktu', r.waktu, 'alasan', r.alasan)
           order by r.waktu desc)
    from (
      select f.found_id, f.kode, 'dibuat'::text as aksi, f.created_at as waktu, null::text as alasan
      from public.found_reports f
      where f.user_id = v_uid
      union all
      select f.found_id, f.kode,
             case a.action when 'temuan_diubah' then 'diubah'
                           when 'temuan_ditutup' then 'ditutup'
                           else a.action end,
             a.occurred_at, a.alasan
      from public.audit_records a
      join public.found_reports f on f.found_id = a.object_id
      where a.object_type = 'found_report' and f.user_id = v_uid
    ) r
  ), '[]'::jsonb));
end;
$function$
;

drop policy if exists photos_insert on public.photos;
drop policy if exists photos_delete on public.photos;
drop policy if exists rahasia_insert on public.data_rahasia;
revoke insert, delete on table public.photos from authenticated;

revoke all on function public.found_report_input_error(text, text, text, text, text, text, uuid, date, time, text[]) from public, anon, authenticated;

revoke all on function public.rpc_create_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[]) from public, anon, authenticated;
grant execute on function public.rpc_create_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[]) to authenticated;

revoke all on function public.rpc_update_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.rpc_update_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[], uuid[]) to authenticated;

revoke all on function public.rpc_close_found_report(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_close_found_report(uuid, text) to authenticated;

revoke all on function public.rpc_get_my_found_report_history() from public, anon, authenticated;
grant execute on function public.rpc_get_my_found_report_history() to authenticated;

commit;
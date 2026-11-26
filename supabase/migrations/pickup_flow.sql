begin;

alter table public.found_reports drop constraint if exists found_reports_status_check;
alter table public.found_reports add constraint found_reports_status_check
  check (status in ('menunggu', 'tersedia', 'dicadangkan', 'diserahkan', 'ditutup'));
alter table public.found_reports alter column status set default 'menunggu';

alter table public.found_reports
  add column if not exists diterima_at   timestamptz,
  add column if not exists diterima_oleh uuid references public.users (user_id);

alter table public.claims
  add column if not exists kode_pengambilan text,
  add column if not exists batas_ambil_at   timestamptz,
  add column if not exists kode_gagal       smallint not null default 0,
  add column if not exists diserahkan_at    timestamptz,
  add column if not exists diserahkan_oleh  uuid references public.users (user_id);

alter table public.claims drop constraint if exists claims_kode_pengambilan_check;
alter table public.claims add constraint claims_kode_pengambilan_check
  check (kode_pengambilan is null or kode_pengambilan ~ '^[0-9]{6}$');

create unique index if not exists claims_kode_aktif_key
  on public.claims (kode_pengambilan) where status = 'disetujui';
create index if not exists claims_batas_ambil_idx
  on public.claims (batas_ambil_at) where status = 'disetujui';
create index if not exists found_reports_area_menunggu_idx
  on public.found_reports (area_id) where status = 'menunggu';

create or replace function public.internal_format_wib(p_waktu timestamptz)
returns text
language sql
immutable
set search_path to ''
as $$
  select to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24.MI') || ' WIB'
$$;

create or replace function public.internal_new_pickup_code()
returns text
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_kode text;
begin
  loop
    v_kode := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (
      select 1 from public.claims where status = 'disetujui' and kode_pengambilan = v_kode);
  end loop;
  return v_kode;
end;
$$;

update public.found_reports
set diterima_at = created_at
where status <> 'menunggu' and diterima_at is null;

do $$
declare
  r record;
begin
  for r in select claim_id from public.claims
           where status = 'disetujui' and kode_pengambilan is null
  loop
    update public.claims
    set kode_pengambilan = public.internal_new_pickup_code(),
        batas_ambil_at   = now() + interval '7 days'
    where claim_id = r.claim_id;
  end loop;
end;
$$;

drop policy if exists found_select on public.found_reports;
create policy found_select on public.found_reports
  as permissive for select to authenticated
  using (
    public.is_verified()
    and (status <> 'menunggu'
         or user_id = (select auth.uid())
         or public.is_admin_for_area(area_id))
  );

grant select (batas_ambil_at, diserahkan_at) on table public.claims to authenticated;

create or replace function public.rpc_create_found_report(
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
  v_admin     boolean := false;
  v_status    text;
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

  v_admin  := public.is_admin_for_area(p_area_id);
  v_status := case when v_admin then 'tersedia' else 'menunggu' end;

  begin
    insert into public.found_reports (
      user_id, area_id, client_request_id, kategori, kategori_lainnya, deskripsi,
      warna, merek, lokasi_temuan, tanggal_temuan, jam_temuan,
      status, diterima_at, diterima_oleh
    )
    values (
      v_uid, p_area_id, p_client_request_id, v_kategori, v_lainnya, v_deskripsi,
      v_warna, v_merek, v_lokasi, p_tanggal_temuan, p_jam_temuan,
      v_status, case when v_admin then now() end, case when v_admin then v_uid end
    )
    returning found_id, kode into v_found;

    insert into public.data_rahasia (found_id, ciri_rahasia)
    values (v_found.found_id, v_ciri);

    insert into public.photos (found_id, storage_path)
    select v_found.found_id, t.p from unnest(v_paths) as t(p);

    if v_admin then
      insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
      values (v_uid, 'found_report', v_found.found_id, 'temuan_diterima', 'Dicatat langsung oleh admin.');
    end if;
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
    'found_id', v_found.found_id, 'kode', v_found.kode, 'status', v_status,
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
  if v_old.status not in ('menunggu', 'tersedia') then
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
    'found_id', p_found_id, 'kode', v_old.kode, 'status', v_old.status,
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
  if v_found.status not in ('menunggu', 'tersedia') then
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

create or replace function public.rpc_search_reports(
  p_jenis      text    default 'semua', 
  p_kata_kunci text    default null,
  p_kategori   text    default null,
  p_area_id    uuid    default null,
  p_status     text    default null,    
  p_halaman    integer default 1,
  p_kode       text    default null    
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $$
declare
  c_per_halaman constant integer := 20;
  v_uid      uuid    := auth.uid();
  v_jenis    text    := lower(btrim(coalesce(p_jenis, 'semua')));
  v_kata     text    := nullif(btrim(coalesce(p_kata_kunci, '')), '');
  v_kategori text    := nullif(btrim(coalesce(p_kategori, '')), '');
  v_area     uuid    := p_area_id;
  v_status   text    := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_halaman  integer := coalesce(p_halaman, 1);
  v_kode     text    := nullif(upper(btrim(coalesce(p_kode, ''))), '');
  v_pola     text;
  v_hasil    jsonb;
begin

  if v_jenis not in ('semua', 'kehilangan', 'penemuan') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'VALIDATION', 'message', 'Jenis laporan tidak dikenal.', 'field', 'jenis'));
  end if;

  if v_status is not null
     and v_status not in ('semua', 'aktif', 'tersedia', 'dicadangkan', 'diserahkan', 'ditutup') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'VALIDATION', 'message', 'Status tidak dikenal.', 'field', 'status'));
  end if;

  if (v_jenis = 'kehilangan' and v_status in ('tersedia', 'dicadangkan', 'diserahkan'))
     or (v_jenis = 'penemuan' and v_status = 'aktif') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'VALIDATION', 'message', 'Status tidak sesuai jenis laporan.', 'field', 'status'));
  end if;

  if v_kata is not null and char_length(v_kata) > 100 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'VALIDATION', 'message', 'Kata kunci maksimal 100 karakter.', 'field', 'kata_kunci'));
  end if;

  if v_halaman < 1 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'VALIDATION', 'message', 'Nomor halaman tidak valid.', 'field', 'halaman'));
  end if;

  if v_kode is not null then
    v_jenis    := 'semua';
    v_kata     := null;
    v_kategori := null;
    v_area     := null;
    v_status   := 'semua';
    v_halaman  := 1;
  end if;

  if v_kata is not null then
    v_pola := '%' || replace(replace(replace(v_kata, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with
  dasar as (

    select 'lost'::text             as jenis,
           l.lost_id                as id,
           l.kode,
           l.user_id,
           l.kategori,
           l.kategori_lainnya,
           l.deskripsi,
           l.warna,
           l.merek,
           l.area_id,
           l.lokasi_kehilangan      as lokasi,
           l.tanggal_kehilangan     as tanggal,
           l.jam_kehilangan         as jam,
           l.status,
           l.created_at
    from public.lost_reports l
    where (v_kode is null or l.kode = v_kode)
      and ((v_status is null and l.status = 'aktif') or v_status = 'semua' or l.status = v_status)
      and (v_kategori is null or l.kategori = v_kategori)
      and (v_area is null or l.area_id = v_area)
      and (v_pola is null
           or l.deskripsi         ilike v_pola
           or l.merek             ilike v_pola
           or l.lokasi_kehilangan ilike v_pola
           or l.warna             ilike v_pola)

    union all

    select 'found'::text,
           f.found_id,
           f.kode,
           f.user_id,
           f.kategori,
           f.kategori_lainnya,
           f.deskripsi,
           f.warna,
           f.merek,
           f.area_id,
           f.lokasi_temuan,
           f.tanggal_temuan,
           f.jam_temuan,
           f.status,
           f.created_at
    from public.found_reports f
    where (v_kode is null or f.kode = v_kode)
      and f.status <> 'menunggu'
      and ((v_status is null and f.status = 'tersedia') or v_status = 'semua' or f.status = v_status)
      and (v_kategori is null or f.kategori = v_kategori)
      and (v_area is null or f.area_id = v_area)
      and (v_pola is null
           or f.deskripsi     ilike v_pola
           or f.merek         ilike v_pola
           or f.lokasi_temuan ilike v_pola
           or f.warna         ilike v_pola)
  ),
  dipilih as (
    select * from dasar d
    where v_jenis = 'semua'
       or (v_jenis = 'kehilangan' and d.jenis = 'lost')
       or (v_jenis = 'penemuan'   and d.jenis = 'found')
  ),
  satu_halaman as (
    select * from dipilih
    order by created_at desc, kode desc
    limit c_per_halaman
    offset (v_halaman - 1) * c_per_halaman
  ),
  hitung as (
    select (select count(*) from dipilih)                          as total,
           (select count(*) from dasar)                            as semua,
           (select count(*) from dasar where jenis = 'lost')       as kehilangan,
           (select count(*) from dasar where jenis = 'found')      as penemuan
  )
  select jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'total',         h.total,
      'halaman',       v_halaman,
      'per_halaman',   c_per_halaman,
      'total_halaman', ceil(h.total::numeric / c_per_halaman)::integer,
      'jumlah_jenis',  jsonb_build_object(
                         'semua',      h.semua,
                         'kehilangan', h.kehilangan,
                         'penemuan',   h.penemuan),
      'statistik',     jsonb_build_object(
                         'barang_tersedia', (select count(*) from public.found_reports
                                             where status = 'tersedia'),
                         'temuan_baru',     (select count(*) from public.found_reports
                                             where status = 'tersedia'
                                               and created_at >= now() - interval '7 days'),
                         'laporan_aktif',   (select count(*) from public.lost_reports
                                             where status = 'aktif')),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id',               s.id,
                 'kode',             s.kode,
                 'jenis',            s.jenis,
                 'kategori',         s.kategori,
                 'kategori_lainnya', s.kategori_lainnya,
                 'deskripsi',        s.deskripsi,
                 'warna',            s.warna,
                 'merek',            s.merek,
                 'area_id',          s.area_id,
                 'nama_area',        a.nama_area,
                 'lokasi',           s.lokasi,
                 'tanggal',          s.tanggal,
                 'jam',              s.jam,
                 'status',           s.status,
                 'created_at',       s.created_at,
                 'milik_saya',       coalesce(s.user_id = v_uid, false),
                 'foto', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'photo_id', p.photo_id,
                            'storage_path', p.storage_path)
                          order by p.created_at, p.photo_id)
                   from public.photos p
                   where (s.jenis = 'lost'  and p.lost_id  = s.id)
                      or (s.jenis = 'found' and p.found_id = s.id)
                 ), '[]'::jsonb))
               order by s.created_at desc, s.kode desc)
        from satu_halaman s
        left join public.areas a on a.area_id = s.area_id
      ), '[]'::jsonb)
    )
  )
  into v_hasil
  from hitung h;

  return v_hasil;
end;
$$;

create or replace function public.rpc_approve_claim(p_claim_id uuid, p_ciri_cocok integer[], p_alasan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_alasan   text := btrim(coalesce(p_alasan, ''));
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_ciri     text[];
  v_cocok    int[];
  v_rej      record;
  v_ditolak  int := 0;
  v_kode     text;
  v_batas    timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_claim_id is null then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  if p_ciri_cocok is null or cardinality(p_ciri_cocok) < 1
     or exists (select 1 from unnest(p_ciri_cocok) as t(x) where x is null) then
    return public.rpc_field_error('ciri_cocok', 'Pilih minimal satu ciri rahasia yang cocok dengan bukti pemohon.');
  end if;

  if char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_field_error('alasan', 'Alasan persetujuan wajib diisi, 3 sampai 1000 karakter.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang memutuskan klaim ini.');
  end if;

  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh memutuskan klaim yang Anda ajukan atau atas temuan yang Anda laporkan.');
  end if;

  if exists (
    select 1 from public.claims
    where found_id = v_found_id and user_id = v_uid and status in ('menunggu', 'disetujui')
  ) then
    return public.rpc_error('FORBIDDEN', 'Anda memiliki klaim aktif atas barang ini, sehingga tidak boleh memutuskan klaim lain untuk barang yang sama.');
  end if;

  if v_claim.status <> 'menunggu' then
    return public.rpc_error('CONFLICT', 'Klaim ini sudah diputuskan atau dibatalkan.');
  end if;

  if v_found.status <> 'tersedia' then
    return public.rpc_error('CONFLICT', 'Status temuan sudah berubah. Muat ulang halaman.');
  end if;

  select ciri_rahasia into v_ciri from public.data_rahasia where found_id = v_found_id;
  if not found then
    return public.rpc_error('CONFLICT', 'Data ciri rahasia untuk temuan ini tidak ditemukan.');
  end if;

  if exists (
    select 1 from unnest(p_ciri_cocok) as t(x)
    where x < 1 or x > cardinality(v_ciri)
  ) then
    return public.rpc_field_error('ciri_cocok', 'Nomor ciri yang cocok berada di luar daftar ciri rahasia.');
  end if;

  v_cocok := array(select distinct x from unnest(p_ciri_cocok) as t(x) order by x);

  v_kode := public.internal_new_pickup_code();

  begin
    update public.claims
    set status = 'disetujui',
        alasan = v_alasan,
        ciri_cocok = v_cocok,
        decision_at = now(),
        decision_by = v_uid,
        kode_pengambilan = v_kode,
        batas_ambil_at = v_batas,
        kode_gagal = 0
    where claim_id = p_claim_id;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Sudah ada klaim lain yang disetujui untuk temuan ini.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'claim', p_claim_id, 'klaim_disetujui', v_alasan);

  perform public.internal_notify(
    v_claim.user_id, 'klaim_disetujui',
    'Klaim Anda untuk barang ' || v_found.kode || ' disetujui. Ambil di TU fakultas paling lambat '
      || public.internal_format_wib(v_batas)
      || ' dengan membawa KTM dan kode pengambilan (lihat di Klaim Saya).'
  );

  for v_rej in
    update public.claims
    set status = 'ditolak',
        alasan = 'Klaim lain untuk barang ini telah disetujui.',
        decision_at = now(),
        decision_by = v_uid
    where found_id = v_found_id
      and status = 'menunggu'
      and claim_id <> p_claim_id
    returning claim_id, user_id
  loop
    v_ditolak := v_ditolak + 1;

    insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
    values (v_uid, 'claim', v_rej.claim_id, 'klaim_ditolak_otomatis',
            'Klaim lain untuk barang ini telah disetujui.');

    perform public.internal_notify(
      v_rej.user_id, 'klaim_ditolak',
      'Klaim Anda untuk barang ' || v_found.kode || ' ditolak karena klaim lain telah disetujui.'
    );
  end loop;

  update public.found_reports
  set status = 'dicadangkan'
  where found_id = v_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', v_found_id, 'temuan_dicadangkan', null);

  perform public.internal_notify(
    v_found.user_id, 'status_temuan',
    'Status laporan temuan ' || v_found.kode || ' berubah menjadi Dicadangkan.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id,
    'status', 'disetujui',
    'status_temuan', 'dicadangkan',
    'batas_ambil_at', v_batas,
    'jumlah_ditolak_otomatis', v_ditolak
  ));
end;
$$;

create or replace function public.rpc_receive_found_item(p_found_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_found public.found_reports%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_found_id is null then
    return public.rpc_error('VALIDATION', 'Laporan temuan tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = p_found_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Laporan temuan tidak ditemukan.');
  end if;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang menerima barang untuk area ini.');
  end if;

  if v_found.status <> 'menunggu' then
    if v_found.status = 'tersedia' then
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'found_id', p_found_id, 'kode', v_found.kode, 'status', 'tersedia',
        'diterima_at', v_found.diterima_at, 'duplikat', true));
    end if;
    return public.rpc_error('CONFLICT', 'Laporan ini sudah diproses. Muat ulang halaman.');
  end if;

  update public.found_reports
  set status = 'tersedia', diterima_at = now(), diterima_oleh = v_uid
  where found_id = p_found_id
  returning * into v_found;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', p_found_id, 'temuan_diterima', null);

  if v_found.user_id <> v_uid then
    perform public.internal_notify(
      v_found.user_id, 'status_temuan',
      'Barang temuan Anda ' || v_found.kode || ' sudah diterima TU dan kini tampil di katalog. Terima kasih!'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', p_found_id, 'kode', v_found.kode, 'status', 'tersedia',
    'diterima_at', v_found.diterima_at, 'duplikat', false));
end;
$$;

create or replace function public.rpc_get_my_pickup_code(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v     record;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  select c.claim_id, c.status, c.kode_pengambilan, c.batas_ambil_at, f.kode as kode_barang
  into v
  from public.claims c
  join public.found_reports f on f.found_id = c.found_id
  where c.claim_id = p_claim_id and c.user_id = v_uid;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;
  if v.status <> 'disetujui' then
    return public.rpc_error('CONFLICT', 'Kode pengambilan hanya ada untuk klaim yang disetujui.');
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', v.claim_id,
    'kode_barang', v.kode_barang,
    'kode_pengambilan', v.kode_pengambilan,
    'batas_ambil_at', v.batas_ambil_at,
    'kedaluwarsa', v.batas_ambil_at < now()));
end;
$$;

create or replace function public.rpc_complete_pickup(p_claim_id uuid, p_kode text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c_maks_salah constant int := 5;
  v_uid      uuid := (select auth.uid());
  v_kode     text := btrim(coalesce(p_kode, ''));
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_salah    int;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_claim_id is null then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;
  if v_kode !~ '^[0-9]{6}$' then
    return public.rpc_field_error('kode', 'Kode pengambilan terdiri dari 6 angka.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang menyelesaikan pengambilan ini.');
  end if;

  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh menyelesaikan pengambilan untuk klaim yang Anda ajukan atau atas temuan yang Anda laporkan.');
  end if;

  if v_claim.status = 'selesai' then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'claim_id', p_claim_id, 'status', 'selesai', 'status_temuan', v_found.status,
      'diserahkan_at', v_claim.diserahkan_at, 'duplikat', true));
  end if;
  if v_claim.status <> 'disetujui' then
    return public.rpc_error('CONFLICT', 'Klaim ini tidak sedang menunggu diambil.');
  end if;
  if v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status temuan sudah berubah. Muat ulang halaman.');
  end if;
  if v_claim.batas_ambil_at is not null and v_claim.batas_ambil_at < now() then
    return public.rpc_field_error('kode', 'Batas pengambilan sudah lewat. Klaim ini akan dibatalkan.');
  end if;

  if v_claim.kode_pengambilan is distinct from v_kode then
    update public.claims set kode_gagal = kode_gagal + 1
    where claim_id = p_claim_id
    returning kode_gagal into v_salah;

    if v_salah >= c_maks_salah then
      update public.claims
      set kode_pengambilan = public.internal_new_pickup_code(), kode_gagal = 0
      where claim_id = p_claim_id;

      insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
      values (v_uid, 'claim', p_claim_id, 'kode_pengambilan_diganti', 'Kode salah dimasukkan 5 kali.');

      perform public.internal_notify(
        v_claim.user_id, 'kode_pengambilan',
        'Kode pengambilan untuk barang ' || v_found.kode || ' diganti karena salah dimasukkan 5 kali. Lihat kode baru di Klaim Saya.'
      );
      return public.rpc_field_error('kode', 'Kode salah 5 kali. Kode lama tidak berlaku dan pemilik menerima kode baru.');
    end if;

    return public.rpc_field_error('kode', 'Kode pengambilan salah. Sisa ' || (c_maks_salah - v_salah) || ' percobaan.');
  end if;

  update public.claims
  set status = 'selesai', diserahkan_at = now(), diserahkan_oleh = v_uid, kode_gagal = 0
  where claim_id = p_claim_id
  returning * into v_claim;

  update public.found_reports set status = 'diserahkan' where found_id = v_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'claim', p_claim_id, 'pengambilan_selesai', null),
         (v_uid, 'found_report', v_found_id, 'temuan_diserahkan', null);

  perform public.internal_notify(
    v_claim.user_id, 'klaim_selesai',
    'Barang ' || v_found.kode || ' sudah Anda ambil. Klaim selesai.'
  );
  if v_found.user_id <> v_claim.user_id then
    perform public.internal_notify(
      v_found.user_id, 'status_temuan',
      'Barang temuan Anda ' || v_found.kode || ' sudah diambil pemiliknya. Terima kasih!'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id, 'status', 'selesai', 'status_temuan', 'diserahkan',
    'diserahkan_at', v_claim.diserahkan_at, 'duplikat', false));
end;
$$;

create or replace function public.rpc_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard jsonb := public.internal_admin_guard();
  v_areas uuid[];
begin
  if v_guard is not null then
    return v_guard;
  end if;
  v_areas := public.internal_admin_areas();

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'temuan_menunggu', (select count(*) from public.found_reports f
                        where f.area_id = any (v_areas) and f.status = 'menunggu'),
    'klaim_disetujui', (select count(*) from public.claims c
                        join public.found_reports f on f.found_id = c.found_id
                        where f.area_id = any (v_areas) and c.status = 'disetujui'),
    'temuan_tersedia', (select count(*) from public.found_reports f
                        where f.area_id = any (v_areas) and f.status = 'tersedia'),
    'temuan_total',    (select count(*) from public.found_reports f
                        where f.area_id = any (v_areas)),
    'kehilangan_aktif', (select count(*) from public.lost_reports l
                         where l.area_id = any (v_areas) and l.status = 'aktif'),
    'klaim_menunggu',  (select count(*) from public.claims c
                        join public.found_reports f on f.found_id = c.found_id
                        where f.area_id = any (v_areas) and c.status = 'menunggu'),
    'jadwal_diajukan', (select count(*) from public.handover_schedules s
                        join public.claims c on c.claim_id = s.claim_id
                        join public.found_reports f on f.found_id = c.found_id
                        where f.area_id = any (v_areas) and s.status = 'diajukan'),
    'jadwal_aktif',    (select count(*) from public.handover_schedules s
                        join public.claims c on c.claim_id = s.claim_id
                        join public.found_reports f on f.found_id = c.found_id
                        where f.area_id = any (v_areas) and s.status in ('diajukan', 'terjadwal'))
  ));
end;
$$;

create or replace function public.rpc_admin_list_claims(
  p_status  text default null,
  p_area_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard jsonb := public.internal_admin_guard();
  v_uid   uuid := (select auth.uid());
  v_areas uuid[];
begin
  if v_guard is not null then
    return v_guard;
  end if;

  if p_status is not null
     and p_status not in ('menunggu', 'disetujui', 'ditolak', 'dibatalkan', 'selesai') then
    return public.rpc_field_error('status', 'Status klaim tidak dikenal.');
  end if;

  v_areas := public.internal_admin_areas();
  if p_area_id is not null then
    if not (p_area_id = any (v_areas)) then
      return public.rpc_error('FORBIDDEN', 'Area ini di luar kewenangan Anda.');
    end if;
    v_areas := array[p_area_id];
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'jumlah', (
      select jsonb_build_object(
        'menunggu',   count(*) filter (where c.status = 'menunggu'),
        'disetujui',  count(*) filter (where c.status = 'disetujui'),
        'ditolak',    count(*) filter (where c.status = 'ditolak'),
        'dibatalkan', count(*) filter (where c.status = 'dibatalkan'),
        'selesai',    count(*) filter (where c.status = 'selesai'))
      from public.claims c
      join public.found_reports f on f.found_id = c.found_id
      where f.area_id = any (v_areas)
    ),
    'items', coalesce((
      select jsonb_agg(x.item order by x.urut, x.tanggal desc)
      from (
        select
          case c.status when 'menunggu' then 0 when 'disetujui' then 1 else 2 end as urut,
          c.tanggal_pengajuan as tanggal,
          jsonb_build_object(
            'claim_id', c.claim_id,
            'status', c.status,
            'bukti', c.ciri_kepemilikan,
            'alasan', c.alasan,
            'ciri_cocok', coalesce(to_jsonb(c.ciri_cocok), '[]'::jsonb),
            'tanggal_pengajuan', c.tanggal_pengajuan,
            'decision_at', c.decision_at,
            'batas_ambil_at', c.batas_ambil_at,
            'diserahkan_at', c.diserahkan_at,
            'pemutus', (select u2.nama from public.users u2 where u2.user_id = c.decision_by),
            'pemohon', jsonb_build_object('nama', u.nama, 'email', u.email),
            'temuan', jsonb_build_object(
              'found_id', f.found_id,
              'kode', f.kode,
              'kategori', f.kategori,
              'kategori_lainnya', f.kategori_lainnya,
              'deskripsi', f.deskripsi,
              'lokasi', f.lokasi_temuan,
              'area_id', f.area_id,
              'nama_area', a.nama_area,
              'status', f.status),
            'ciri_rahasia', coalesce(to_jsonb(r.ciri_rahasia), '[]'::jsonb),
            'konflik', (
              v_uid in (c.user_id, f.user_id)
              or exists (select 1 from public.claims c2
                         where c2.found_id = f.found_id and c2.user_id = v_uid
                           and c2.status in ('menunggu', 'disetujui'))
            )
          ) as item
        from public.claims c
        join public.found_reports f on f.found_id = c.found_id
        join public.areas a on a.area_id = f.area_id
        join public.users u on u.user_id = c.user_id
        left join public.data_rahasia r on r.found_id = f.found_id
        where f.area_id = any (v_areas)
          and (p_status is null or c.status = p_status)
      ) x
    ), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.rpc_admin_list_reports(
  p_jenis   text default 'semua',
  p_status  text default null,
  p_area_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard jsonb := public.internal_admin_guard();
  v_jenis text := coalesce(p_jenis, 'semua');
  v_areas uuid[];
begin
  if v_guard is not null then
    return v_guard;
  end if;

  if v_jenis not in ('semua', 'kehilangan', 'penemuan') then
    return public.rpc_field_error('jenis', 'Jenis laporan tidak dikenal.');
  end if;
  if p_status is not null
     and p_status not in ('aktif', 'menunggu', 'tersedia', 'dicadangkan', 'diserahkan', 'ditutup') then
    return public.rpc_field_error('status', 'Status laporan tidak dikenal.');
  end if;

  v_areas := public.internal_admin_areas();
  if p_area_id is not null then
    if not (p_area_id = any (v_areas)) then
      return public.rpc_error('FORBIDDEN', 'Area ini di luar kewenangan Anda.');
    end if;
    v_areas := array[p_area_id];
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'jumlah', jsonb_build_object(
      'kehilangan', (select count(*) from public.lost_reports l where l.area_id = any (v_areas)),
      'penemuan',   (select count(*) from public.found_reports f where f.area_id = any (v_areas))
    ),
    'items', coalesce((
      select jsonb_agg(x.item order by x.created_at desc, x.kode desc)
      from (
        select f.created_at, f.kode,
          jsonb_build_object(
            'jenis', 'penemuan',
            'id', f.found_id,
            'kode', f.kode,
            'kategori', f.kategori,
            'kategori_lainnya', f.kategori_lainnya,
            'deskripsi', f.deskripsi,
            'warna', f.warna,
            'merek', f.merek,
            'lokasi', f.lokasi_temuan,
            'tanggal', f.tanggal_temuan,
            'jam', f.jam_temuan,
            'area_id', f.area_id,
            'nama_area', a.nama_area,
            'status', f.status,
            'created_at', f.created_at,
            'diterima_at', f.diterima_at,
            'ada_klaim', exists (select 1 from public.claims c
                                 where c.found_id = f.found_id and c.status = 'menunggu'),
            'ciri_rahasia', coalesce(to_jsonb(r.ciri_rahasia), '[]'::jsonb),
            'klaim_aktif', (select count(*) from public.claims c
                            where c.found_id = f.found_id and c.status in ('menunggu', 'disetujui')),
            'foto', coalesce((select jsonb_agg(jsonb_build_object('photo_id', p.photo_id, 'storage_path', p.storage_path)
                                               order by p.created_at)
                              from public.photos p where p.found_id = f.found_id), '[]'::jsonb)
          ) as item
        from public.found_reports f
        join public.areas a on a.area_id = f.area_id
        left join public.data_rahasia r on r.found_id = f.found_id
        where v_jenis in ('semua', 'penemuan')
          and f.area_id = any (v_areas)
          and (p_status is null or f.status = p_status)
        union all
        select l.created_at, l.kode,
          jsonb_build_object(
            'jenis', 'kehilangan',
            'id', l.lost_id,
            'kode', l.kode,
            'kategori', l.kategori,
            'kategori_lainnya', l.kategori_lainnya,
            'deskripsi', l.deskripsi,
            'warna', l.warna,
            'merek', l.merek,
            'lokasi', l.lokasi_kehilangan,
            'tanggal', l.tanggal_kehilangan,
            'jam', l.jam_kehilangan,
            'area_id', l.area_id,
            'nama_area', a.nama_area,
            'status', l.status,
            'created_at', l.created_at,
            'diterima_at', null,
            'ada_klaim', false,
            'ciri_rahasia', '[]'::jsonb,
            'klaim_aktif', 0,
            'foto', coalesce((select jsonb_agg(jsonb_build_object('photo_id', p.photo_id, 'storage_path', p.storage_path)
                                               order by p.created_at)
                              from public.photos p where p.lost_id = l.lost_id), '[]'::jsonb)
          )
        from public.lost_reports l
        join public.areas a on a.area_id = l.area_id
        where v_jenis in ('semua', 'kehilangan')
          and l.area_id = any (v_areas)
          and (p_status is null or l.status = p_status)
      ) x
    ), '[]'::jsonb)
  ));
end;
$$;

revoke all on function public.internal_format_wib(timestamptz) from public, anon, authenticated;
revoke all on function public.internal_new_pickup_code() from public, anon, authenticated;

revoke all on function public.rpc_create_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[]) from public, anon, authenticated;
grant execute on function public.rpc_create_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[]) to authenticated;
revoke all on function public.rpc_update_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.rpc_update_found_report(uuid, uuid, text, text, text, date, text[], text, time, text, text, text[], uuid[]) to authenticated;
revoke all on function public.rpc_close_found_report(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_close_found_report(uuid, text) to authenticated;
revoke all on function public.rpc_search_reports(text, text, text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.rpc_search_reports(text, text, text, uuid, text, integer, text) to authenticated;
revoke all on function public.rpc_approve_claim(uuid, integer[], text) from public, anon, authenticated;
grant execute on function public.rpc_approve_claim(uuid, integer[], text) to authenticated;
revoke all on function public.rpc_receive_found_item(uuid) from public, anon, authenticated;
grant execute on function public.rpc_receive_found_item(uuid) to authenticated;
revoke all on function public.rpc_get_my_pickup_code(uuid) from public, anon, authenticated;
grant execute on function public.rpc_get_my_pickup_code(uuid) to authenticated;
revoke all on function public.rpc_complete_pickup(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_complete_pickup(uuid, text) to authenticated;
revoke all on function public.rpc_admin_dashboard() from public, anon, authenticated;
grant execute on function public.rpc_admin_dashboard() to authenticated;
revoke all on function public.rpc_admin_list_claims(text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_claims(text, uuid) to authenticated;
revoke all on function public.rpc_admin_list_reports(text, text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_reports(text, text, uuid) to authenticated;

commit;
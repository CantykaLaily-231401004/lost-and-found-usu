begin;

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

create or replace function public.rpc_get_report_timeline(p_kode text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_kode    text := nullif(upper(btrim(coalesce(p_kode, ''))), '');
  v_id      uuid;
  v_jenis   text;
  v_dibuat  timestamptz;
  v_items   jsonb;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if v_kode is null then
    return public.rpc_field_error('kode', 'Kode laporan wajib diisi.');
  end if;

  select l.lost_id, 'lost', l.created_at
    into v_id, v_jenis, v_dibuat
  from public.lost_reports l
  where l.kode = v_kode;

  if not found then
    select f.found_id, 'found', f.created_at
      into v_id, v_jenis, v_dibuat
    from public.found_reports f
    where f.kode = v_kode;
  end if;

  if v_id is null then
    return public.rpc_error('VALIDATION', 'Laporan tidak ditemukan.');
  end if;

  select jsonb_agg(jsonb_build_object('peristiwa', e.peristiwa, 'waktu', e.waktu)
                   order by e.waktu, e.urut)
    into v_items
  from (
    select 'dilaporkan'::text as peristiwa, v_dibuat as waktu, 0 as urut
    union all
    select case a.action
             when 'kehilangan_diubah'       then 'diperbarui'
             when 'temuan_diubah'           then 'diperbarui'
             when 'temuan_dicadangkan'      then 'dicadangkan'
             when 'temuan_tersedia_kembali' then 'tersedia_kembali'
             when 'temuan_diserahkan'       then 'diserahkan'
             when 'kehilangan_ditutup'      then 'ditutup'
             when 'temuan_ditutup'          then 'ditutup'
           end,
           a.occurred_at,
           1
    from public.audit_records a
    where a.object_id = v_id
      and a.object_type = case v_jenis when 'lost' then 'lost_report' else 'found_report' end
      and a.action in ('kehilangan_diubah', 'temuan_diubah', 'temuan_dicadangkan',
                       'temuan_tersedia_kembali', 'temuan_diserahkan',
                       'kehilangan_ditutup', 'temuan_ditutup')
  ) e;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('kode', v_kode, 'jenis', v_jenis, 'items', v_items));
end;
$$;

revoke all on function public.rpc_search_reports(text, text, text, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.rpc_search_reports(text, text, text, uuid, text, integer, text)
  to authenticated;

revoke all on function public.rpc_get_report_timeline(text)
  from public, anon, authenticated;
grant execute on function public.rpc_get_report_timeline(text)
  to authenticated;

commit;
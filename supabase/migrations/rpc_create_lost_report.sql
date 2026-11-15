begin;

create or replace function public.rpc_field_error(p_field text, p_message text)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', 'VALIDATION', 'message', p_message, 'field', p_field)
  );
$$;

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
  v_now_wib   timestamp := now() at time zone 'Asia/Jakarta';
  v_paths     text[];
  v_prefix    text;
  v_lost      record;
begin
  -- 1. Sesi dan verifikasi akun
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi. Verifikasi surel terlebih dahulu.');
  end if;
  if p_client_request_id is null then
    return public.rpc_error('VALIDATION', 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.');
  end if;

  -- 2. Kiriman ulang dengan kunci yang sama: kembalikan laporan yang sudah tersimpan
  select lost_id, kode, status into v_lost
  from public.lost_reports
  where user_id = v_uid and client_request_id = p_client_request_id;
  if found then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'lost_id', v_lost.lost_id, 'kode', v_lost.kode, 'status', v_lost.status, 'duplikat', true));
  end if;

  -- 3. Validasi isian, urut sesuai form
  if v_kategori not in ('Dompet & Tas', 'Dokumen & Kartu', 'Elektronik', 'Kunci', 'Kacamata',
                        'Pakaian & Aksesoris', 'Alat Tulis & Buku', 'Botol & Wadah', 'Lainnya') then
    return public.rpc_field_error('kategori', 'Pilih kategori barang dari daftar.');
  end if;
  if v_kategori = 'Lainnya' then
    if v_lainnya is null or char_length(v_lainnya) not between 3 and 50 then
      return public.rpc_field_error('kategori_lainnya', 'Sebutkan jenis barangnya, 3 sampai 50 karakter.');
    end if;
  else
    v_lainnya := null;  -- kategori baku: jenis barang diabaikan
  end if;
  if char_length(v_deskripsi) not between 20 and 2000 then
    return public.rpc_field_error('deskripsi', 'Deskripsi wajib diisi, 20 sampai 2000 karakter.');
  end if;
  if v_warna is not null and char_length(v_warna) > 30 then
    return public.rpc_field_error('warna', 'Warna maksimal 30 karakter.');
  end if;
  if v_merek is not null and char_length(v_merek) > 50 then
    return public.rpc_field_error('merek', 'Merek maksimal 50 karakter.');
  end if;
  if char_length(v_lokasi) not between 1 and 150 then
    return public.rpc_field_error('lokasi_kehilangan', 'Lokasi kejadian wajib diisi, maksimal 150 karakter.');
  end if;
  if p_area_id is null or not exists (select 1 from public.areas where area_id = p_area_id) then
    return public.rpc_field_error('area_id', 'Pilih area kampus dari daftar.');
  end if;
  if p_tanggal_kehilangan is null then
    return public.rpc_field_error('tanggal_kehilangan', 'Tanggal kehilangan wajib diisi.');
  end if;
  if p_tanggal_kehilangan > v_now_wib::date then
    return public.rpc_field_error('tanggal_kehilangan', 'Tanggal kehilangan tidak boleh di masa depan.');
  end if;
  if p_jam_kehilangan is not null and (p_tanggal_kehilangan + p_jam_kehilangan) > v_now_wib then
    return public.rpc_field_error('jam_kehilangan', 'Waktu kehilangan tidak boleh melewati waktu saat ini.');
  end if;

  -- 4. Foto (opsional): maks 3, harus di folder {uid}/{client_request_id}/, dan sudah terunggah
  v_paths := array(
    select distinct btrim(x) from unnest(coalesce(p_photo_paths, '{}'::text[])) as t(x)
    where btrim(x) <> ''
  );
  if cardinality(v_paths) > 3 then
    return public.rpc_field_error('photos', 'Maksimal 3 foto per laporan.');
  end if;
  v_prefix := v_uid::text || '/' || p_client_request_id::text || '/';
  if exists (select 1 from unnest(v_paths) as t(p) where left(t.p, char_length(v_prefix)) <> v_prefix) then
    return public.rpc_field_error('photos', 'Lokasi foto tidak valid. Unggah ulang foto.');
  end if;
  if exists (
    select 1 from unnest(v_paths) as t(p)
    where not exists (select 1 from storage.objects o where o.bucket_id = 'report-photos' and o.name = t.p)
  ) then
    return public.rpc_field_error('photos', 'Ada foto yang belum terunggah. Unggah ulang atau kirim tanpa foto.');
  end if;

  -- 5. Simpan laporan + foto. Kalau salah satu gagal, semuanya dibatalkan.
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
      -- dua kiriman dengan kunci sama masuk bersamaan; yang kalah mengembalikan laporan pemenang
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

-- Hak akses: hanya user login yang boleh memanggil RPC; fungsi pembantu tidak bisa dipanggil langsung.
revoke all on function public.rpc_field_error(text, text) from public, anon, authenticated;
revoke all on function public.rpc_create_lost_report(uuid, uuid, text, text, text, date, text, time, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.rpc_create_lost_report(uuid, uuid, text, text, text, date, text, time, text, text, text[])
  to authenticated;

commit;
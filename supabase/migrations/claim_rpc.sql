begin;

do $$
begin
  if exists (select 1 from public.claims where char_length(btrim(ciri_kepemilikan)) < 15) then
    raise exception 'Ada klaim dengan bukti kurang dari 15 karakter. Migrasi dihentikan.';
  end if;
end $$;

alter table public.claims drop constraint claims_ciri_kepemilikan_check;
alter table public.claims add constraint claims_ciri_kepemilikan_check
  check (char_length(btrim(ciri_kepemilikan)) between 15 and 1000);

create or replace function public.rpc_submit_claim(p_found_id uuid, p_ciri_kepemilikan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_text   text := btrim(coalesce(p_ciri_kepemilikan, ''));
  v_found  public.found_reports%rowtype;
  v_claim  public.claims%rowtype;
  v_count  int;
  v_admin  uuid;
  v_admins uuid[];
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi. Verifikasi surel terlebih dahulu.');
  end if;

  if p_found_id is null or char_length(v_text) not between 15 and 1000 then
    return public.rpc_error('VALIDATION', 'Uraian bukti kepemilikan harus 15 sampai 1000 karakter.');
  end if;

  select * into v_found
  from public.found_reports
  where found_id = p_found_id
  for update;

  if not found then
    return public.rpc_error('VALIDATION', 'Laporan temuan tidak ditemukan.');
  end if;

  if v_found.user_id = v_uid then
    return public.rpc_error('FORBIDDEN', 'Anda tidak dapat mengklaim barang temuan yang Anda laporkan sendiri.');
  end if;

  select * into v_claim
  from public.claims
  where user_id = v_uid and found_id = p_found_id and status = 'menunggu';

  if found then
    if v_claim.ciri_kepemilikan = v_text then
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'claim_id', v_claim.claim_id,
        'status', v_claim.status,
        'tanggal_pengajuan', v_claim.tanggal_pengajuan,
        'duplikat', true
      ));
    end if;
    return public.rpc_error('CONFLICT', 'Anda masih memiliki klaim yang menunggu untuk barang ini. Batalkan dulu jika ingin mengajukan ulang.');
  end if;

  if v_found.status <> 'tersedia' then
    return public.rpc_error('CONFLICT', 'Barang ini sudah tidak tersedia untuk diklaim.');
  end if;

  select count(*) into v_count
  from public.claims
  where user_id = v_uid
    and found_id = p_found_id
    and created_at > now() - interval '24 hours';

  if v_count >= 3 then
    return public.rpc_error('RATE_LIMITED', 'Batas 3 pengajuan klaim untuk barang ini dalam 24 jam sudah tercapai. Coba lagi nanti.');
  end if;

  begin
    insert into public.claims (user_id, found_id, ciri_kepemilikan)
    values (v_uid, p_found_id, v_text)
    returning * into v_claim;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Pengajuan bersamaan terdeteksi. Muat ulang dan periksa daftar klaim Anda.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'claim', v_claim.claim_id, 'klaim_diajukan', null);

  v_admins := array(
    select u.user_id
    from public.penugasan_admin pa
    join public.users u on u.user_id = pa.admin_id
    where pa.area_id = v_found.area_id
      and pa.status = 'aktif'
      and u.role = 'admin_fakultas'
      and u.verified_at is not null
      and u.user_id not in (v_uid, v_found.user_id)
  );

  if cardinality(v_admins) = 0 then
    v_admins := array(
      select u.user_id
      from public.users u
      where u.role = 'admin_pusat'
        and u.verified_at is not null
        and u.user_id not in (v_uid, v_found.user_id)
    );
  end if;

  foreach v_admin in array v_admins loop
    perform public.internal_notify(
      v_admin, 'klaim_baru',
      'Klaim baru untuk temuan ' || v_found.kode || ' menunggu verifikasi.'
    );
  end loop;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', v_claim.claim_id,
    'status', v_claim.status,
    'tanggal_pengajuan', v_claim.tanggal_pengajuan,
    'duplikat', false
  ));
end;
$$;

revoke all on function public.rpc_submit_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_submit_claim(uuid, text) to authenticated;

commit;
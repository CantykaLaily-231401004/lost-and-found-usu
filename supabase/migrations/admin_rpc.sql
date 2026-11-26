begin;

create or replace function public.has_active_claim(p_found_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.claims c
    join public.found_reports f on f.found_id = c.found_id
    where c.found_id = p_found_id
      and c.status in ('menunggu', 'disetujui')
      and (f.user_id = (select auth.uid()) or public.is_admin_for_area(f.area_id))
  );
$$;

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

  if exists (
    select 1 from public.users
    where user_id = v_uid and role in ('admin_fakultas', 'admin_pusat')
  ) then
    return public.rpc_error('FORBIDDEN', 'Akun admin tidak dapat mengajukan klaim barang.');
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

  v_admins := public.internal_area_admins(v_found.area_id, array[v_uid, v_found.user_id]);

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

  begin
    update public.claims
    set status = 'disetujui',
        alasan = v_alasan,
        ciri_cocok = v_cocok,
        decision_at = now(),
        decision_by = v_uid
    where claim_id = p_claim_id;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Sudah ada klaim lain yang disetujui untuk temuan ini.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'claim', p_claim_id, 'klaim_disetujui', v_alasan);

  perform public.internal_notify(
    v_claim.user_id, 'klaim_disetujui',
    'Klaim Anda untuk barang ' || v_found.kode || ' disetujui. Ajukan waktu pengambilan di menu Jadwal.'
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
    'jumlah_ditolak_otomatis', v_ditolak
  ));
end;
$$;

create or replace function public.rpc_reject_claim(p_claim_id uuid, p_alasan text)
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

  if char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_field_error('alasan', 'Alasan penolakan wajib diisi, 3 sampai 1000 karakter.');
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

  update public.claims
  set status = 'ditolak',
      alasan = v_alasan,
      decision_at = now(),
      decision_by = v_uid
  where claim_id = p_claim_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'claim', p_claim_id, 'klaim_ditolak', v_alasan);

  perform public.internal_notify(
    v_claim.user_id, 'klaim_ditolak',
    'Klaim Anda untuk barang ' || v_found.kode || ' ditolak. Lihat alasannya di menu Klaim Saya.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id,
    'status', 'ditolak'
  ));
end;
$$;

create or replace function public.rpc_cancel_claim(p_claim_id uuid, p_alasan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid           uuid := (select auth.uid());
  v_alasan        text := btrim(coalesce(p_alasan, ''));
  v_found_id      uuid;
  v_found         public.found_reports%rowtype;
  v_claim         public.claims%rowtype;
  v_is_owner      boolean;
  v_was_approved  boolean;
  v_sched         record;
  v_jadwal        int := 0;
  v_status_temuan text;
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

  if char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_field_error('alasan', 'Alasan pembatalan wajib diisi, 3 sampai 1000 karakter.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  v_is_owner := (v_claim.user_id = v_uid);

  if v_is_owner then
    if v_claim.status = 'disetujui' then
      return public.rpc_error('FORBIDDEN', 'Klaim yang sudah disetujui hanya dapat dibatalkan oleh admin.');
    end if;
    if v_claim.status <> 'menunggu' then
      return public.rpc_error('CONFLICT', 'Klaim ini sudah tidak dapat dibatalkan.');
    end if;
  else
    if not public.is_admin_for_area(v_found.area_id) then
      return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang membatalkan klaim ini.');
    end if;
    if v_uid = v_found.user_id then
      return public.rpc_error('FORBIDDEN', 'Anda tidak boleh membatalkan klaim atas temuan yang Anda laporkan.');
    end if;
    if exists (
      select 1 from public.claims
      where found_id = v_found_id and user_id = v_uid and status in ('menunggu', 'disetujui')
    ) then
      return public.rpc_error('FORBIDDEN', 'Anda memiliki klaim aktif atas barang ini, sehingga tidak boleh membatalkan klaim lain untuk barang yang sama.');
    end if;
    if v_claim.status = 'menunggu' then
      return public.rpc_error('CONFLICT', 'Klaim yang masih menunggu tidak dapat dibatalkan admin. Setujui atau tolak klaim tersebut.');
    end if;
    if v_claim.status <> 'disetujui' then
      return public.rpc_error('CONFLICT', 'Klaim ini sudah tidak dapat dibatalkan.');
    end if;
  end if;

  v_was_approved := (v_claim.status = 'disetujui');

  update public.claims
  set status = 'dibatalkan',
      alasan = v_alasan,
      decision_at = case when v_is_owner then decision_at else now() end,
      decision_by = case when v_is_owner then decision_by else v_uid end
  where claim_id = p_claim_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (
    v_uid, 'claim', p_claim_id,
    case when v_is_owner then 'klaim_dibatalkan_pemohon' else 'klaim_dibatalkan_admin' end,
    v_alasan
  );

  v_status_temuan := v_found.status;

  if v_was_approved then
    for v_sched in
      update public.handover_schedules
      set status = 'dibatalkan',
          alasan_batal = 'Klaim dibatalkan admin. Lihat alasannya di menu Klaim Saya.'
      where claim_id = p_claim_id and status in ('diajukan', 'terjadwal')
      returning schedule_id
    loop
      v_jadwal := v_jadwal + 1;
      insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
      values (v_uid, 'handover_schedule', v_sched.schedule_id, 'jadwal_dibatalkan_otomatis', null);
    end loop;

    update public.found_reports
    set status = 'tersedia'
    where found_id = v_found_id and status = 'dicadangkan';

    v_status_temuan := 'tersedia';

    insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
    values (v_uid, 'found_report', v_found_id, 'temuan_tersedia_kembali', null);

    perform public.internal_notify(
      v_found.user_id, 'status_temuan',
      'Status laporan temuan ' || v_found.kode || ' kembali menjadi Tersedia.'
    );
  end if;

  if not v_is_owner then
    perform public.internal_notify(
      v_claim.user_id, 'klaim_dibatalkan',
      'Klaim Anda untuk barang ' || v_found.kode || ' dibatalkan oleh admin.'
        || case when v_jadwal > 0 then ' Jadwal pengambilan ikut dibatalkan.' else '' end
        || ' Lihat alasannya di menu Klaim Saya.'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id,
    'status', 'dibatalkan',
    'status_temuan', v_status_temuan,
    'jadwal_dibatalkan', v_jadwal
  ));
end;
$$;

create or replace function public.internal_admin_guard()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if cardinality(public.internal_admin_areas()) = 0 then
    return public.rpc_error('FORBIDDEN', 'Halaman ini khusus admin.');
  end if;
  return null;
end;
$$;

create or replace function public.internal_audit_object_code(p_object_type text, p_object_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case p_object_type
    when 'found_report' then
      (select f.kode from public.found_reports f where f.found_id = p_object_id)
    when 'lost_report' then
      (select l.kode from public.lost_reports l where l.lost_id = p_object_id)
    when 'claim' then
      (select f.kode from public.claims c
       join public.found_reports f on f.found_id = c.found_id
       where c.claim_id = p_object_id)
    when 'handover_schedule' then
      (select f.kode from public.handover_schedules s
       join public.claims c on c.claim_id = s.claim_id
       join public.found_reports f on f.found_id = c.found_id
       where s.schedule_id = p_object_id)
    else null
  end;
$$;

create or replace function public.rpc_admin_get_me()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard jsonb := public.internal_admin_guard();
  v_user  public.users%rowtype;
begin
  if v_guard is not null then
    return v_guard;
  end if;

  select * into v_user from public.users where user_id = (select auth.uid());

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'role', v_user.role,
    'nama', v_user.nama,
    'email', v_user.email,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'area_id', a.area_id, 'nama_area', a.nama_area, 'jenis_area', a.jenis_area)
             order by a.jenis_area, a.nama_area)
      from public.areas a
      where a.area_id = any (public.internal_admin_areas())
    ), '[]'::jsonb)
  ));
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
     and p_status not in ('aktif', 'tersedia', 'dicadangkan', 'diserahkan', 'ditutup') then
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

create or replace function public.rpc_admin_list_schedules(
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

  if p_status is not null and p_status not in ('diajukan', 'terjadwal', 'dibatalkan', 'selesai') then
    return public.rpc_field_error('status', 'Status jadwal tidak dikenal.');
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
        'diajukan',   count(*) filter (where s.status = 'diajukan'),
        'terjadwal',  count(*) filter (where s.status = 'terjadwal'),
        'dibatalkan', count(*) filter (where s.status = 'dibatalkan'),
        'selesai',    count(*) filter (where s.status = 'selesai'))
      from public.handover_schedules s
      join public.claims c on c.claim_id = s.claim_id
      join public.found_reports f on f.found_id = c.found_id
      where f.area_id = any (v_areas)
    ),
    'klaim_perlu_jadwal', coalesce((
      select jsonb_agg(jsonb_build_object(
               'claim_id', c.claim_id,
               'decision_at', c.decision_at,
               'pemohon', jsonb_build_object('nama', u.nama, 'email', u.email),
               'temuan', jsonb_build_object('kode', f.kode, 'kategori', f.kategori,
                                            'kategori_lainnya', f.kategori_lainnya,
                                            'deskripsi', f.deskripsi, 'nama_area', a.nama_area),
               'konflik', v_uid in (c.user_id, f.user_id))
             order by c.decision_at)
      from public.claims c
      join public.found_reports f on f.found_id = c.found_id
      join public.areas a on a.area_id = f.area_id
      join public.users u on u.user_id = c.user_id
      where f.area_id = any (v_areas)
        and c.status = 'disetujui'
        and not exists (select 1 from public.handover_schedules s
                        where s.claim_id = c.claim_id and s.status in ('diajukan', 'terjadwal'))
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(x.item order by x.urut, x.waktu)
      from (
        select
          case s.status when 'diajukan' then 0 when 'terjadwal' then 1 else 2 end as urut,
          s.waktu,
          jsonb_build_object(
            'schedule_id', s.schedule_id,
            'status', s.status,
            'waktu', s.waktu,
            'lokasi', s.lokasi,
            'catatan', s.catatan,
            'catatan_pemohon', s.catatan_pemohon,
            'alasan_batal', s.alasan_batal,
            'konfirmasi_pemilik_at', s.konfirmasi_pemilik_at,
            'konfirmasi_penyerah_at', s.konfirmasi_penyerah_at,
            'completed_at', s.completed_at,
            'created_at', s.created_at,
            'penanggung_jawab', (select pj.nama from public.users pj where pj.user_id = s.penanggung_jawab_id),
            'claim_id', c.claim_id,
            'status_klaim', c.status,
            'pemohon', jsonb_build_object('nama', u.nama, 'email', u.email),
            'temuan', jsonb_build_object('kode', f.kode, 'kategori', f.kategori,
                                         'kategori_lainnya', f.kategori_lainnya,
                                         'deskripsi', f.deskripsi, 'area_id', f.area_id,
                                         'nama_area', a.nama_area, 'status', f.status),
            'konflik', v_uid in (c.user_id, f.user_id)
          ) as item
        from public.handover_schedules s
        join public.claims c on c.claim_id = s.claim_id
        join public.found_reports f on f.found_id = c.found_id
        join public.areas a on a.area_id = f.area_id
        join public.users u on u.user_id = c.user_id
        where f.area_id = any (v_areas)
          and (p_status is null or s.status = p_status)
      ) x
    ), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.rpc_admin_list_audit(
  p_area_id  uuid default null,
  p_halaman  int  default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard   jsonb := public.internal_admin_guard();
  v_pusat   boolean := public.is_admin_pusat();
  v_areas   uuid[];
  v_halaman int := greatest(coalesce(p_halaman, 1), 1);
begin
  if v_guard is not null then
    return v_guard;
  end if;

  v_areas := public.internal_admin_areas();
  if p_area_id is not null and not (p_area_id = any (v_areas)) then
    return public.rpc_error('FORBIDDEN', 'Area ini di luar kewenangan Anda.');
  end if;

  return (
    with terlihat as (
      select a.audit_id, a.occurred_at, a.actor_id, a.object_type, a.object_id, a.action, a.alasan,
             coalesce(a.area_id, public.internal_audit_area(a.object_type, a.object_id)) as area_id
      from public.audit_records a
    ),
    tersaring as (
      select t.*
      from terlihat t
      where (p_area_id is null or t.area_id = p_area_id)
        and (v_pusat or t.area_id = any (v_areas))
    )
    select jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'total', (select count(*) from tersaring),
      'halaman', v_halaman,
      'per_halaman', 50,
      'total_halaman', greatest(ceil((select count(*) from tersaring) / 50.0)::int, 1),
      'items', coalesce((
        select jsonb_agg(x.item order by x.occurred_at desc, x.audit_id)
        from (
          select t.occurred_at, t.audit_id,
            jsonb_build_object(
              'audit_id', t.audit_id,
              'waktu', t.occurred_at,
              'pelaku', jsonb_build_object('nama', u.nama, 'email', u.email, 'role', u.role),
              'objek', t.object_type,
              'kode', public.internal_audit_object_code(t.object_type, t.object_id),
              'aksi', t.action,
              'alasan', t.alasan,
              'area_id', t.area_id,
              'nama_area', ar.nama_area
            ) as item
          from tersaring t
          left join public.users u on u.user_id = t.actor_id
          left join public.areas ar on ar.area_id = t.area_id
          order by t.occurred_at desc, t.audit_id
          limit 50 offset (v_halaman - 1) * 50
        ) x
      ), '[]'::jsonb)
    ))
  );
end;
$$;

create or replace function public.rpc_admin_list_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_guard jsonb := public.internal_admin_guard();
begin
  if v_guard is not null then
    return v_guard;
  end if;
  if not public.is_admin_pusat() then
    return public.rpc_error('FORBIDDEN', 'Halaman ini khusus admin pusat.');
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', u.user_id,
               'nama', u.nama,
               'email', u.email,
               'role', u.role,
               'terverifikasi', u.verified_at is not null,
               'penugasan', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'area_id', pa.area_id, 'nama_area', a.nama_area, 'status', pa.status,
                          'assigned_at', pa.assigned_at, 'revoked_at', pa.revoked_at)
                        order by pa.status, a.nama_area)
                 from public.penugasan_admin pa
                 join public.areas a on a.area_id = pa.area_id
                 where pa.admin_id = u.user_id
               ), '[]'::jsonb))
             order by case u.role when 'admin_pusat' then 0 else 1 end, u.email)
      from public.users u
      where u.role in ('admin_pusat', 'admin_fakultas')
    ), '[]'::jsonb)
  ));
end;
$$;

revoke all on function public.has_active_claim(uuid) from public, anon, authenticated;
grant execute on function public.has_active_claim(uuid) to authenticated;
revoke all on function public.rpc_submit_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_submit_claim(uuid, text) to authenticated;
revoke all on function public.rpc_approve_claim(uuid, integer[], text) from public, anon, authenticated;
grant execute on function public.rpc_approve_claim(uuid, integer[], text) to authenticated;
revoke all on function public.rpc_reject_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_reject_claim(uuid, text) to authenticated;
revoke all on function public.rpc_cancel_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_claim(uuid, text) to authenticated;

revoke all on function public.internal_admin_guard() from public, anon, authenticated;
revoke all on function public.internal_audit_object_code(text, uuid) from public, anon, authenticated;

revoke all on function public.rpc_admin_get_me() from public, anon, authenticated;
grant execute on function public.rpc_admin_get_me() to authenticated;
revoke all on function public.rpc_admin_dashboard() from public, anon, authenticated;
grant execute on function public.rpc_admin_dashboard() to authenticated;
revoke all on function public.rpc_admin_list_claims(text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_claims(text, uuid) to authenticated;
revoke all on function public.rpc_admin_list_reports(text, text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_reports(text, text, uuid) to authenticated;
revoke all on function public.rpc_admin_list_schedules(text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_schedules(text, uuid) to authenticated;
revoke all on function public.rpc_admin_list_audit(uuid, int) from public, anon, authenticated;
grant execute on function public.rpc_admin_list_audit(uuid, int) to authenticated;
revoke all on function public.rpc_admin_list_accounts() from public, anon, authenticated;
grant execute on function public.rpc_admin_list_accounts() to authenticated;

commit;
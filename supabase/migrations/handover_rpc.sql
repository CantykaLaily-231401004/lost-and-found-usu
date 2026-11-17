begin;

drop function if exists public.rpc_complete_handover(uuid, boolean, boolean);

create or replace function public.internal_area_admins(p_area_id uuid, p_exclude uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_admins uuid[];
begin
  v_admins := array(
    select u.user_id
    from public.penugasan_admin pa
    join public.users u on u.user_id = pa.admin_id
    where pa.area_id = p_area_id
      and pa.status = 'aktif'
      and u.role = 'admin_fakultas'
      and u.verified_at is not null
      and u.user_id <> all (coalesce(p_exclude, '{}'))
  );

  if cardinality(v_admins) = 0 then
    v_admins := array(
      select u.user_id
      from public.users u
      where u.role = 'admin_pusat'
        and u.verified_at is not null
        and u.user_id <> all (coalesce(p_exclude, '{}'))
    );
  end if;

  return v_admins;
end;
$$;

create or replace function public.internal_finish_handover(p_schedule_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_claim_id uuid;
  v_found_id uuid;
  v_kode     text;
  v_pemohon  uuid;
  v_pelapor  uuid;
begin
  select h.claim_id, c.found_id, f.kode, c.user_id, f.user_id
    into v_claim_id, v_found_id, v_kode, v_pemohon, v_pelapor
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  join public.found_reports f on f.found_id = c.found_id
  where h.schedule_id = p_schedule_id;

  update public.handover_schedules
  set status = 'selesai', completed_at = now()
  where schedule_id = p_schedule_id;

  update public.claims set status = 'selesai' where claim_id = v_claim_id;
  update public.found_reports set status = 'diserahkan' where found_id = v_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values
    (p_actor, 'handover_schedule', p_schedule_id, 'serah_terima_selesai', null),
    (p_actor, 'claim', v_claim_id, 'klaim_selesai', null),
    (p_actor, 'found_report', v_found_id, 'temuan_diserahkan', null);

  perform public.internal_notify(
    v_pemohon, 'serah_terima_selesai',
    'Pengambilan barang ' || v_kode || ' selesai. Barang sudah Anda terima.'
  );
  perform public.internal_notify(
    v_pelapor, 'serah_terima_selesai',
    'Barang temuan ' || v_kode || ' sudah diambil pemiliknya. Terima kasih sudah melapor.'
  );
end;
$$;

create or replace function public.rpc_request_schedule(
  p_claim_id uuid,
  p_waktu    timestamptz,
  p_catatan  text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_found_id uuid;
  v_owner    uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
  v_admin    uuid;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_claim_id is null then
    return public.rpc_error('VALIDATION', 'Klaim wajib dipilih.');
  end if;
  if p_waktu is null then
    return public.rpc_field_error('waktu', 'Pilih tanggal dan jam pengambilan.');
  end if;
  if p_waktu <= now() then
    return public.rpc_field_error('waktu', 'Waktu pengambilan harus berada di masa depan.');
  end if;
  if v_catatan is not null and char_length(v_catatan) > 500 then
    return public.rpc_field_error('catatan', 'Catatan maksimal 500 karakter.');
  end if;

  select found_id, user_id into v_found_id, v_owner
  from public.claims where claim_id = p_claim_id;
  if not found or v_owner <> v_uid then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Waktu pengambilan hanya dapat diajukan untuk klaim yang sudah disetujui.');
  end if;

  select * into v_sched
  from public.handover_schedules
  where claim_id = p_claim_id and status in ('diajukan', 'terjadwal')
  for update;

  if found then
    -- klik ganda: pengajuan yang sama dianggap berhasil, tidak membuat baris baru
    if v_sched.status = 'diajukan' and v_sched.waktu = p_waktu
       and v_sched.catatan_pemohon is not distinct from v_catatan then
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'schedule_id', v_sched.schedule_id, 'status', 'diajukan', 'duplikat', true
      ));
    end if;
    return public.rpc_error('CONFLICT', 'Klaim ini sudah memiliki pengajuan atau jadwal pengambilan yang berjalan. Batalkan dulu jika ingin mengganti waktu.');
  end if;

  begin
    insert into public.handover_schedules (claim_id, waktu, lokasi, status, catatan_pemohon)
    values (p_claim_id, p_waktu, null, 'diajukan', v_catatan)
    returning * into v_sched;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Pengajuan bersamaan terdeteksi. Muat ulang halaman.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', v_sched.schedule_id, 'jadwal_diajukan', null);

  foreach v_admin in array public.internal_area_admins(v_found.area_id, array[v_uid, v_found.user_id]) loop
    perform public.internal_notify(
      v_admin, 'jadwal_diajukan',
      'Pengajuan waktu pengambilan untuk temuan ' || v_found.kode || ' pada '
        || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI')
        || ' WIB menunggu persetujuan.'
    );
  end loop;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', v_sched.schedule_id, 'status', 'diajukan', 'duplikat', false
  ));
end;
$$;

create or replace function public.rpc_approve_schedule(
  p_schedule_id uuid,
  p_waktu       timestamptz,
  p_lokasi      text,
  p_catatan     text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_lokasi   text := btrim(coalesce(p_lokasi, ''));
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_schedule_id is null then
    return public.rpc_error('VALIDATION', 'Jadwal wajib dipilih.');
  end if;
  if p_waktu is null or p_waktu <= now() then
    return public.rpc_field_error('waktu', 'Waktu pengambilan wajib diisi dan harus berada di masa depan.');
  end if;
  if char_length(v_lokasi) not between 1 and 200 then
    return public.rpc_field_error('lokasi', 'Tempat pengambilan wajib diisi, 1 sampai 200 karakter.');
  end if;
  if v_catatan is not null and char_length(v_catatan) > 1000 then
    return public.rpc_field_error('catatan', 'Catatan maksimal 1000 karakter.');
  end if;

  select h.claim_id, c.found_id into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur pengambilan barang ini.');
  end if;
  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur pengambilan atas klaim atau temuan Anda sendiri.');
  end if;
  if v_sched.status <> 'diajukan' then
    return public.rpc_error('CONFLICT', 'Pengajuan ini sudah diproses atau dibatalkan.');
  end if;
  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status klaim atau temuan sudah berubah. Muat ulang halaman.');
  end if;

  update public.handover_schedules
  set status = 'terjadwal',
      waktu = p_waktu,
      lokasi = v_lokasi,
      catatan = v_catatan,
      penanggung_jawab_id = v_uid
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'jadwal_disetujui', null);

  perform public.internal_notify(
    v_claim.user_id, 'jadwal_dibuat',
    'Pengambilan barang ' || v_found.kode || ' dijadwalkan pada '
      || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB di ' || v_lokasi || '.'
      || case when p_waktu <> v_sched.waktu then ' Waktu ini berbeda dari pengajuan Anda.' else '' end
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id, 'status', 'terjadwal'
  ));
end;
$$;

create or replace function public.rpc_create_schedule(
  p_claim_id uuid,
  p_waktu    timestamptz,
  p_lokasi   text,
  p_catatan  text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_lokasi   text := btrim(coalesce(p_lokasi, ''));
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_claim_id is null then
    return public.rpc_error('VALIDATION', 'Klaim wajib dipilih.');
  end if;
  if p_waktu is null or p_waktu <= now() then
    return public.rpc_field_error('waktu', 'Waktu pengambilan wajib diisi dan harus berada di masa depan.');
  end if;
  if char_length(v_lokasi) not between 1 and 200 then
    return public.rpc_field_error('lokasi', 'Tempat pengambilan wajib diisi, 1 sampai 200 karakter.');
  end if;
  if v_catatan is not null and char_length(v_catatan) > 1000 then
    return public.rpc_field_error('catatan', 'Catatan maksimal 1000 karakter.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur pengambilan barang ini.');
  end if;
  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur pengambilan atas klaim atau temuan Anda sendiri.');
  end if;
  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Jadwal hanya dapat dibuat untuk klaim yang berstatus Disetujui.');
  end if;
  if exists (
    select 1 from public.handover_schedules
    where claim_id = p_claim_id and status in ('diajukan', 'terjadwal')
  ) then
    return public.rpc_error('CONFLICT', 'Klaim ini sudah memiliki pengajuan atau jadwal yang berjalan. Setujui, ubah, atau batalkan dulu.');
  end if;

  begin
    insert into public.handover_schedules (claim_id, waktu, lokasi, catatan, status, penanggung_jawab_id)
    values (p_claim_id, p_waktu, v_lokasi, v_catatan, 'terjadwal', v_uid)
    returning * into v_sched;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Jadwal bersamaan terdeteksi. Muat ulang halaman.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', v_sched.schedule_id, 'jadwal_dibuat', null);

  perform public.internal_notify(
    v_claim.user_id, 'jadwal_dibuat',
    'Pengambilan barang ' || v_found.kode || ' dijadwalkan pada '
      || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB di ' || v_lokasi || '.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', v_sched.schedule_id, 'status', 'terjadwal'
  ));
end;
$$;

create or replace function public.rpc_update_schedule(
  p_schedule_id uuid,
  p_waktu       timestamptz,
  p_lokasi      text,
  p_catatan     text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_lokasi   text := btrim(coalesce(p_lokasi, ''));
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_schedule_id is null then
    return public.rpc_error('VALIDATION', 'Jadwal wajib dipilih.');
  end if;
  if p_waktu is null or p_waktu <= now() then
    return public.rpc_field_error('waktu', 'Waktu pengambilan wajib diisi dan harus berada di masa depan.');
  end if;
  if char_length(v_lokasi) not between 1 and 200 then
    return public.rpc_field_error('lokasi', 'Tempat pengambilan wajib diisi, 1 sampai 200 karakter.');
  end if;
  if v_catatan is not null and char_length(v_catatan) > 1000 then
    return public.rpc_field_error('catatan', 'Catatan maksimal 1000 karakter.');
  end if;

  select h.claim_id, c.found_id into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur pengambilan barang ini.');
  end if;
  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur pengambilan atas klaim atau temuan Anda sendiri.');
  end if;
  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Hanya jadwal yang sudah disetujui yang dapat diubah.');
  end if;
  if v_sched.konfirmasi_penyerah_at is not null then
    return public.rpc_error('CONFLICT', 'Barang sudah dikonfirmasi diserahkan. Jadwal tidak dapat diubah.');
  end if;
  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status klaim atau temuan sudah berubah. Muat ulang halaman.');
  end if;

  update public.handover_schedules
  set waktu = p_waktu,
      lokasi = v_lokasi,
      catatan = v_catatan,
      penanggung_jawab_id = v_uid
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'jadwal_diubah', null);

  perform public.internal_notify(
    v_claim.user_id, 'jadwal_diubah',
    'Jadwal pengambilan barang ' || v_found.kode || ' diubah menjadi '
      || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB di ' || v_lokasi || '.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id, 'status', 'terjadwal'
  ));
end;
$$;

create or replace function public.rpc_cancel_schedule(p_schedule_id uuid, p_alasan text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_alasan   text := btrim(coalesce(p_alasan, ''));
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
  v_owner    boolean;
  v_jenis    text;
  v_admin    uuid;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;
  if p_schedule_id is null then
    return public.rpc_error('VALIDATION', 'Jadwal wajib dipilih.');
  end if;
  if char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_field_error('alasan', 'Alasan pembatalan wajib diisi, 3 sampai 1000 karakter.');
  end if;

  select h.claim_id, c.found_id into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  v_owner := (v_claim.user_id = v_uid);

  if not v_owner then
    if not public.is_admin_for_area(v_found.area_id) then
      return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang membatalkan jadwal ini.');
    end if;
    if v_uid = v_found.user_id then
      return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur pengambilan atas temuan Anda sendiri.');
    end if;
  end if;

  if v_sched.status not in ('diajukan', 'terjadwal') then
    return public.rpc_error('CONFLICT', 'Jadwal ini sudah selesai atau dibatalkan.');
  end if;
  if v_sched.konfirmasi_penyerah_at is not null then
    return public.rpc_error('CONFLICT', 'Admin sudah mengonfirmasi penyerahan barang. Jadwal tidak dapat dibatalkan.');
  end if;

  v_jenis := case when v_sched.status = 'diajukan' then 'Pengajuan waktu pengambilan' else 'Jadwal pengambilan' end;

  update public.handover_schedules
  set status = 'dibatalkan', alasan_batal = v_alasan
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (
    v_uid, 'handover_schedule', p_schedule_id,
    case when v_owner then 'jadwal_dibatalkan_pemohon' else 'jadwal_dibatalkan' end,
    v_alasan
  );

  if v_owner then
    foreach v_admin in array
      case when v_sched.penanggung_jawab_id is not null
                and v_sched.penanggung_jawab_id <> all (array[v_uid, v_found.user_id])
           then array[v_sched.penanggung_jawab_id]
           else public.internal_area_admins(v_found.area_id, array[v_uid, v_found.user_id]) end
    loop
      perform public.internal_notify(
        v_admin, 'jadwal_dibatalkan',
        v_jenis || ' untuk temuan ' || v_found.kode || ' dibatalkan oleh pemohon.'
      );
    end loop;
  else
    perform public.internal_notify(
      v_claim.user_id, 'jadwal_dibatalkan',
      v_jenis || ' barang ' || v_found.kode || ' dibatalkan admin. Lihat alasannya di menu Jadwal.'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id, 'status', 'dibatalkan'
  ));
end;
$$;

create or replace function public.rpc_confirm_pickup(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_claim_id uuid;
  v_found_id uuid;
  v_owner    uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  select h.claim_id, c.found_id, c.user_id into v_claim_id, v_found_id, v_owner
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;
  if not found or v_owner <> v_uid then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_sched.status = 'selesai' then
    return public.rpc_error('CONFLICT', 'Pengambilan barang ini sudah selesai.');
  end if;
  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Konfirmasi hanya dapat dilakukan pada jadwal yang sudah disetujui admin.');
  end if;
  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status klaim atau temuan sudah berubah. Muat ulang halaman.');
  end if;

  if v_sched.konfirmasi_pemilik_at is not null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'schedule_id', p_schedule_id, 'selesai', false, 'duplikat', true
    ));
  end if;

  update public.handover_schedules
  set konfirmasi_pemilik_at = now()
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'konfirmasi_penerimaan', null);

  if v_sched.konfirmasi_penyerah_at is not null then
    perform public.internal_finish_handover(p_schedule_id, v_uid);
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'schedule_id', p_schedule_id, 'selesai', true, 'duplikat', false
    ));
  end if;

  perform public.internal_notify(
    v_sched.penanggung_jawab_id, 'konfirmasi_diperlukan',
    'Pemohon sudah mengonfirmasi penerimaan barang ' || v_found.kode || '. Konfirmasi penyerahan Anda diperlukan.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id, 'selesai', false, 'duplikat', false
  ));
end;
$$;


create or replace function public.rpc_complete_handover(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  select h.claim_id, c.found_id into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  select * into v_found from public.found_reports where found_id = v_found_id for update;
  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang menyelesaikan pengambilan barang ini.');
  end if;
  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh menyelesaikan pengambilan atas klaim atau temuan Anda sendiri.');
  end if;
  if v_sched.status = 'selesai' then
    return public.rpc_error('CONFLICT', 'Pengambilan barang ini sudah selesai.');
  end if;
  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Konfirmasi hanya dapat dilakukan pada jadwal yang sudah disetujui.');
  end if;
  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status klaim atau temuan sudah berubah. Muat ulang halaman.');
  end if;

  if v_sched.konfirmasi_penyerah_at is not null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'schedule_id', p_schedule_id, 'selesai', false, 'duplikat', true
    ));
  end if;

  update public.handover_schedules
  set konfirmasi_penyerah_at = now(),
      dicatat_oleh_admin_id = v_uid
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'konfirmasi_penyerahan', null);

  if v_sched.konfirmasi_pemilik_at is not null then
    perform public.internal_finish_handover(p_schedule_id, v_uid);
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'schedule_id', p_schedule_id, 'selesai', true, 'duplikat', false
    ));
  end if;

  perform public.internal_notify(
    v_claim.user_id, 'konfirmasi_diperlukan',
    'Admin sudah menyerahkan barang ' || v_found.kode
      || '. Tekan Konfirmasi Penerimaan Barang di menu Jadwal setelah barang Anda terima.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id, 'selesai', false, 'duplikat', false
  ));
end;
$$;

create or replace function public.rpc_get_my_schedules()
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
  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'jadwal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schedule_id',            h.schedule_id,
        'claim_id',               h.claim_id,
        'status',                 h.status,
        'waktu',                  h.waktu,
        'lokasi',                 h.lokasi,
        'catatan',                h.catatan,
        'catatan_pemohon',        h.catatan_pemohon,
        'alasan_batal',           h.alasan_batal,
        'penanggung_jawab',       pj.nama,
        'nama_area',              a.nama_area,
        'konfirmasi_pemilik_at',  h.konfirmasi_pemilik_at,
        'konfirmasi_penyerah_at', h.konfirmasi_penyerah_at,
        'completed_at',           h.completed_at,
        'created_at',             h.created_at,
        'kode',                   f.kode,
        'kategori',               f.kategori,
        'kategori_lainnya',       f.kategori_lainnya
      ) order by h.waktu desc, h.created_at desc)
      from public.handover_schedules h
      join public.claims c on c.claim_id = h.claim_id
      join public.found_reports f on f.found_id = c.found_id
      join public.areas a on a.area_id = f.area_id
      left join public.users pj on pj.user_id = h.penanggung_jawab_id
      where c.user_id = v_uid
    ), '[]'::jsonb),
    'perlu_jadwal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id',         c.claim_id,
        'kode',             f.kode,
        'kategori',         f.kategori,
        'kategori_lainnya', f.kategori_lainnya,
        'nama_area',        a.nama_area,
        'decision_at',      c.decision_at
      ) order by c.decision_at desc nulls last)
      from public.claims c
      join public.found_reports f on f.found_id = c.found_id
      join public.areas a on a.area_id = f.area_id
      where c.user_id = v_uid
        and c.status = 'disetujui'
        and not exists (
          select 1 from public.handover_schedules h
          where h.claim_id = c.claim_id and h.status in ('diajukan', 'terjadwal')
        )
    ), '[]'::jsonb),
    'klaim_menunggu', (
      select count(*) from public.claims c
      where c.user_id = v_uid and c.status = 'menunggu'
    )
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
  v_uid          uuid := (select auth.uid());
  v_alasan       text := btrim(coalesce(p_alasan, ''));
  v_found_id     uuid;
  v_found        public.found_reports%rowtype;
  v_claim        public.claims%rowtype;
  v_is_owner     boolean;
  v_was_approved boolean;
  v_sched        record;
  v_jadwal       int := 0;
  v_status_temuan text;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_claim_id is null or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Alasan pembatalan wajib diisi, 3 sampai 1000 karakter.');
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
    if v_claim.status not in ('menunggu', 'disetujui') then
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
      'Status laporan temuan Anda "' || v_found.kategori || '" kembali menjadi Tersedia.'
    );
  end if;

  if not v_is_owner then
    perform public.internal_notify(
      v_claim.user_id, 'klaim_dibatalkan',
      'Klaim Anda atas barang "' || v_found.kategori || '" dibatalkan oleh admin.'
        || case when v_jadwal > 0 then ' Jadwal serah terima ikut dibatalkan.' else '' end
        || ' Lihat alasannya pada detail klaim.'
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

revoke all on function public.internal_area_admins(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.internal_finish_handover(uuid, uuid) from public, anon, authenticated;

revoke all on function public.rpc_request_schedule(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.rpc_request_schedule(uuid, timestamptz, text) to authenticated;

revoke all on function public.rpc_approve_schedule(uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.rpc_approve_schedule(uuid, timestamptz, text, text) to authenticated;

revoke all on function public.rpc_create_schedule(uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.rpc_create_schedule(uuid, timestamptz, text, text) to authenticated;

revoke all on function public.rpc_update_schedule(uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.rpc_update_schedule(uuid, timestamptz, text, text) to authenticated;

revoke all on function public.rpc_cancel_schedule(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_schedule(uuid, text) to authenticated;

revoke all on function public.rpc_confirm_pickup(uuid) from public, anon, authenticated;
grant execute on function public.rpc_confirm_pickup(uuid) to authenticated;

revoke all on function public.rpc_complete_handover(uuid) from public, anon, authenticated;
grant execute on function public.rpc_complete_handover(uuid) to authenticated;

revoke all on function public.rpc_get_my_schedules() from public, anon, authenticated;
grant execute on function public.rpc_get_my_schedules() to authenticated;

revoke all on function public.rpc_cancel_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_cancel_claim(uuid, text) to authenticated;

commit;
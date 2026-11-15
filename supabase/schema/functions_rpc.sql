begin;

set check_function_bodies = false;
set search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.block_audit_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Audit records cannot be modified or deleted';
end;
$function$
;

-- can_view_handover (p_claim_id uuid) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.can_view_handover(p_claim_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.claims c
    join public.found_reports f on f.found_id = c.found_id
    where c.claim_id = p_claim_id
      and (
        c.user_id = (select auth.uid())
        or f.user_id = (select auth.uid())
        or public.is_admin_for_area(f.area_id)
      )
  );
$function$
;

-- ciri_rahasia_valid (items text[]) | SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.ciri_rahasia_valid(items text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select items is not null
    and cardinality(items) between 1 and 5
    and not exists (
      select 1
      from unnest(items) as t(x)
      where x is null or char_length(btrim(x)) not between 3 and 500
    );
$function$
;

-- enforce_campus_email () | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.enforce_campus_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce(split_part(lower(trim(new.email)), '@', 1), '') = ''
     or split_part(lower(trim(new.email)), '@', 2) not in ('students.usu.ac.id', 'usu.ac.id') then
    raise exception 'Only campus email addresses are allowed.';
  end if;
  return new;
end;
$function$
;

-- enforce_photo_limit () | SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_count int;
begin
  if new.found_id is not null then
    select count(*) into v_count from public.photos where found_id = new.found_id;
  else
    select count(*) into v_count from public.photos where lost_id = new.lost_id;
  end if;

  if v_count >= 3 then
    raise exception 'Maximum 3 photos per report';
  end if;

  return new;
end;
$function$
;

-- handle_new_user () | SECURITY DEFINER | search_path=public
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_nama text;
begin
  v_email := lower(btrim(new.email));

  if split_part(v_email, '@', 2) not in ('students.usu.ac.id', 'usu.ac.id') then
    raise exception 'Only students.usu.ac.id or usu.ac.id emails are allowed';
  end if;

  v_nama := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nama', '')), '');
  v_nama := left(coalesce(v_nama, split_part(v_email, '@', 1)), 100);

  insert into public.users (user_id, nama, email, role, verified_at)
  values (new.id, v_nama, v_email, 'pengguna', new.email_confirmed_at);

  return new;
end;
$function$
;

-- handle_user_verified () | SECURITY DEFINER | search_path=public
CREATE OR REPLACE FUNCTION public.handle_user_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.users
  set verified_at = new.email_confirmed_at
  where user_id = new.id;

  return new;
end;
$function$
;

-- has_active_claim (p_found_id uuid) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.has_active_claim(p_found_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.claims c
    where c.found_id = p_found_id and c.status in ('menunggu', 'disetujui')
  );
$function$
;

-- internal_notify (p_user_id uuid, p_jenis text, p_pesan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.internal_notify(p_user_id uuid, p_jenis text, p_pesan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text;
  v_notif uuid;
begin
  select email into v_email from public.users where user_id = p_user_id;
  if v_email is null then
    return;
  end if;

  insert into public.notifications (user_id, jenis, pesan)
  values (p_user_id, p_jenis, left(p_pesan, 500))
  returning notification_id into v_notif;

  insert into public.outbox_surel (notification_id, recipient_email, event_type, next_attempt_at)
  values (v_notif, v_email, p_jenis, now());
end;
$function$
;

-- is_admin_for_area (p_area_id uuid) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.is_admin_for_area(p_area_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_admin_pusat()
    or exists (
      select 1
      from public.penugasan_admin pa
      join public.users u on u.user_id = pa.admin_id
      where pa.admin_id = (select auth.uid())
        and pa.area_id = p_area_id
        and pa.status = 'aktif'
        and u.role = 'admin_fakultas'
        and u.verified_at is not null
    );
$function$
;

-- is_admin_pusat () | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.is_admin_pusat()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.users u
    where u.user_id = (select auth.uid())
      and u.role = 'admin_pusat' and u.verified_at is not null
  );
$function$
;

-- is_verified () | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.is_verified()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.users u
    where u.user_id = (select auth.uid()) and u.verified_at is not null
  );
$function$
;

-- notify_email_confirmed () | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.notify_email_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform realtime.send(
      jsonb_build_object('confirmed', true),
      'email_confirmed',
      'signup:' || new.id::text,
      false
    );
  end if;
  return new;
end;
$function$
;

-- rpc_approve_claim (p_claim_id uuid, p_ciri_cocok integer[], p_alasan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_approve_claim(p_claim_id uuid, p_ciri_cocok integer[], p_alasan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if p_claim_id is null
     or p_ciri_cocok is null
     or cardinality(p_ciri_cocok) < 1
     or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Pilih minimal satu ciri yang cocok dan isi alasan 3 sampai 1000 karakter.');
  end if;

  if exists (select 1 from unnest(p_ciri_cocok) as t(x) where x is null) then
    return public.rpc_error('VALIDATION', 'Daftar ciri yang cocok tidak valid.');
  end if;

  -- urutan kunci: temuan dulu, baru klaim (harus sama di semua RPC)
  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  select * into v_found
  from public.found_reports
  where found_id = v_found_id
  for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang memutuskan klaim ini.');
  end if;

  select * into v_claim
  from public.claims
  where claim_id = p_claim_id
  for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh memutuskan klaim yang Anda ajukan atau atas temuan yang Anda laporkan.');
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
    return public.rpc_error('VALIDATION', 'Nomor ciri yang cocok berada di luar daftar ciri rahasia.');
  end if;

  v_cocok := array(select distinct x from unnest(p_ciri_cocok) as t(x) order by x);

  -- setujui klaim terpilih
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
    'Klaim Anda atas barang "' || v_found.kategori || '" disetujui. Admin akan menjadwalkan serah terima.'
  );

  -- tolak klaim menunggu lainnya untuk temuan yang sama
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
      'Klaim Anda atas barang "' || v_found.kategori || '" ditolak karena klaim lain telah disetujui.'
    );
  end loop;

  -- ubah status temuan
  update public.found_reports
  set status = 'dicadangkan'
  where found_id = v_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', v_found_id, 'temuan_dicadangkan', null);

  perform public.internal_notify(
    v_found.user_id, 'status_temuan',
    'Status laporan temuan Anda "' || v_found.kategori || '" berubah menjadi Dicadangkan.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id,
    'status', 'disetujui',
    'status_temuan', 'dicadangkan',
    'jumlah_ditolak_otomatis', v_ditolak
  ));
end;
$function$
;

-- rpc_cancel_claim (p_claim_id uuid, p_alasan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_cancel_claim(p_claim_id uuid, p_alasan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      set status = 'dibatalkan'
      where claim_id = p_claim_id and status = 'terjadwal'
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
$function$
;

-- rpc_cancel_schedule (p_schedule_id uuid, p_alasan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_cancel_schedule(p_schedule_id uuid, p_alasan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid      uuid := (select auth.uid());
  v_alasan   text := btrim(coalesce(p_alasan, ''));
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
  v_pesan    text;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_schedule_id is null or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Alasan pembatalan jadwal wajib diisi, 3 sampai 1000 karakter.');
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
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur serah terima ini.');
  end if;

  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur serah terima atas klaim atau temuan Anda sendiri.');
  end if;

  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Jadwal ini sudah selesai atau dibatalkan.');
  end if;

  update public.handover_schedules
  set status = 'dibatalkan'
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'jadwal_dibatalkan', v_alasan);

  v_pesan := 'Jadwal serah terima barang "' || v_found.kategori || '" dibatalkan. Admin akan menetapkan jadwal pengganti.';

  perform public.internal_notify(v_claim.user_id, 'jadwal_dibatalkan', v_pesan);
  perform public.internal_notify(v_found.user_id, 'jadwal_dibatalkan', v_pesan);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id,
    'status', 'dibatalkan'
  ));
end;
$function$
;

-- rpc_close_found_report (p_found_id uuid, p_alasan text) | SECURITY DEFINER | search_path=""
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

  if p_found_id is null or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Alasan penutupan wajib diisi, 3 sampai 1000 karakter.');
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

  if exists (
    select 1 from public.claims
    where found_id = p_found_id and status in ('menunggu', 'disetujui')
  ) then
    return public.rpc_error('CONFLICT', 'Masih ada klaim yang menunggu. Tolak atau batalkan klaim tersebut terlebih dahulu.');
  end if;

  update public.found_reports set status = 'ditutup' where found_id = p_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'found_report', p_found_id, 'temuan_ditutup', v_alasan);

  if not v_is_owner then
    perform public.internal_notify(
      v_found.user_id, 'status_temuan',
      'Laporan temuan Anda "' || v_found.kategori || '" ditutup oleh admin.'
    );
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', p_found_id, 'status', 'ditutup'
  ));
end;
$function$
;

-- rpc_close_lost_report (p_lost_id uuid, p_alasan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_close_lost_report(p_lost_id uuid, p_alasan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if p_lost_id is null or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Alasan penutupan wajib diisi, 3 sampai 1000 karakter.');
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
    'lost_id', p_lost_id, 'status', 'ditutup'
  ));
end;
$function$
;

-- rpc_complete_handover (p_schedule_id uuid, p_konfirmasi_pemilik boolean, p_konfirmasi_penyerah boolean) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_complete_handover(p_schedule_id uuid, p_konfirmasi_pemilik boolean, p_konfirmasi_penyerah boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid        uuid := (select auth.uid());
  v_claim_id   uuid;
  v_found_id   uuid;
  v_found      public.found_reports%rowtype;
  v_claim      public.claims%rowtype;
  v_sched      public.handover_schedules%rowtype;
  v_t_pemilik  timestamptz;
  v_t_penyerah timestamptz;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_schedule_id is null then
    return public.rpc_error('VALIDATION', 'Jadwal serah terima wajib diisi.');
  end if;

  select h.claim_id, c.found_id
    into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;

  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal serah terima tidak ditemukan.');
  end if;

  -- urutan kunci sama seperti 5A dan 5B: temuan, klaim, lalu jadwal
  select * into v_found
  from public.found_reports
  where found_id = v_found_id
  for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang menyelesaikan serah terima ini.');
  end if;

  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh menyelesaikan serah terima atas klaim atau temuan Anda sendiri.');
  end if;

  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Jadwal ini sudah selesai atau dibatalkan.');
  end if;

  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Status klaim atau temuan sudah berubah. Muat ulang halaman.');
  end if;

  v_t_pemilik := coalesce(
    v_sched.konfirmasi_pemilik_at,
    case when coalesce(p_konfirmasi_pemilik, false) then now() end
  );
  v_t_penyerah := coalesce(
    v_sched.konfirmasi_penyerah_at,
    case when coalesce(p_konfirmasi_penyerah, false) then now() end
  );

  if v_t_pemilik is null or v_t_penyerah is null then
    return public.rpc_error('CONFLICT', 'Konfirmasi pemilik dan penyerah harus lengkap sebelum serah terima diselesaikan.');
  end if;

  update public.handover_schedules
  set status = 'selesai',
      konfirmasi_pemilik_at = v_t_pemilik,
      konfirmasi_penyerah_at = v_t_penyerah,
      dicatat_oleh_admin_id = v_uid,
      completed_at = now()
  where schedule_id = p_schedule_id;

  update public.claims
  set status = 'selesai'
  where claim_id = v_claim_id;

  update public.found_reports
  set status = 'diserahkan'
  where found_id = v_found_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values
    (v_uid, 'handover_schedule', p_schedule_id, 'serah_terima_selesai', null),
    (v_uid, 'claim', v_claim_id, 'klaim_selesai', null),
    (v_uid, 'found_report', v_found_id, 'temuan_diserahkan', null);

  perform public.internal_notify(
    v_claim.user_id, 'serah_terima_selesai',
    'Serah terima barang "' || v_found.kategori || '" telah diselesaikan.'
  );

  perform public.internal_notify(
    v_found.user_id, 'serah_terima_selesai',
    'Serah terima barang temuan "' || v_found.kategori || '" telah diselesaikan. Terima kasih sudah melapor.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id,
    'status_jadwal', 'selesai',
    'status_klaim', 'selesai',
    'status_temuan', 'diserahkan'
  ));
end;
$function$
;

-- rpc_create_found_report (p_area_id uuid, p_kategori text, p_deskripsi text, p_lokasi_temuan text, p_tanggal_temuan timestamp with time zone, p_ciri_rahasia text[], p_warna text, p_merek text, p_client_request_id uuid) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_create_found_report(p_area_id uuid, p_kategori text, p_deskripsi text, p_lokasi_temuan text, p_tanggal_temuan timestamp with time zone, p_ciri_rahasia text[], p_warna text DEFAULT NULL::text, p_merek text DEFAULT NULL::text, p_client_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid       uuid := (select auth.uid());
  v_kategori  text := btrim(coalesce(p_kategori, ''));
  v_deskripsi text := btrim(coalesce(p_deskripsi, ''));
  v_lokasi    text := btrim(coalesce(p_lokasi_temuan, ''));
  v_warna     text := nullif(btrim(coalesce(p_warna, '')), '');
  v_merek     text := nullif(btrim(coalesce(p_merek, '')), '');
  v_ciri      text[];
  v_found_id  uuid;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi. Verifikasi surel terlebih dahulu.');
  end if;

  -- kiriman ulang dengan kunci yang sama mengembalikan laporan yang sudah tersimpan
  if p_client_request_id is not null then
    select found_id into v_found_id
    from public.found_reports
    where user_id = v_uid and client_request_id = p_client_request_id;

    if found then
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'found_id', v_found_id, 'status', 'tersedia', 'duplikat', true
      ));
    end if;
  end if;

  v_ciri := array(select btrim(x) from unnest(coalesce(p_ciri_rahasia, array[]::text[])) as t(x));

  if p_area_id is null
     or char_length(v_kategori) not between 1 and 100
     or char_length(v_deskripsi) not between 10 and 2000
     or char_length(v_lokasi) not between 1 and 200
     or (v_warna is not null and char_length(v_warna) > 50)
     or (v_merek is not null and char_length(v_merek) > 100) then
    return public.rpc_error('VALIDATION', 'Periksa kembali isian: kategori, deskripsi (10 sampai 2000 karakter), lokasi, warna, dan merek.');
  end if;

  if not public.ciri_rahasia_valid(v_ciri) then
    return public.rpc_error('VALIDATION', 'Ciri rahasia wajib diisi: 1 sampai 5 ciri, masing-masing 3 sampai 500 karakter.');
  end if;

  if p_tanggal_temuan is null or p_tanggal_temuan > now() then
    return public.rpc_error('VALIDATION', 'Tanggal temuan wajib diisi dan tidak boleh di masa depan.');
  end if;

  if not exists (select 1 from public.areas where area_id = p_area_id) then
    return public.rpc_error('VALIDATION', 'Area tidak ditemukan.');
  end if;

  begin
    insert into public.found_reports (
      user_id, area_id, client_request_id, kategori, deskripsi,
      warna, merek, lokasi_temuan, tanggal_temuan
    )
    values (
      v_uid, p_area_id, p_client_request_id, v_kategori, v_deskripsi,
      v_warna, v_merek, v_lokasi, p_tanggal_temuan
    )
    returning found_id into v_found_id;

    insert into public.data_rahasia (found_id, ciri_rahasia)
    values (v_found_id, v_ciri);
  exception when unique_violation then
    select found_id into v_found_id
    from public.found_reports
    where user_id = v_uid and client_request_id = p_client_request_id;

    if found then
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'found_id', v_found_id, 'status', 'tersedia', 'duplikat', true
      ));
    end if;
    return public.rpc_error('CONFLICT', 'Pengiriman bersamaan terdeteksi. Muat ulang dan periksa daftar laporan Anda.');
  end;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'found_id', v_found_id, 'status', 'tersedia', 'duplikat', false
  ));
end;
$function$
;

-- rpc_create_schedule (p_claim_id uuid, p_waktu timestamp with time zone, p_lokasi text, p_catatan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_create_schedule(p_claim_id uuid, p_waktu timestamp with time zone, p_lokasi text, p_catatan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid      uuid := (select auth.uid());
  v_lokasi   text := btrim(coalesce(p_lokasi, ''));
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
  v_pesan    text;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_claim_id is null or p_waktu is null
     or char_length(v_lokasi) not between 1 and 200
     or (v_catatan is not null and char_length(v_catatan) > 1000) then
    return public.rpc_error('VALIDATION', 'Waktu wajib diisi, lokasi 1 sampai 200 karakter, catatan maksimal 1000 karakter.');
  end if;

  if p_waktu <= now() then
    return public.rpc_error('VALIDATION', 'Waktu serah terima harus berada di masa depan.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  -- urutan kunci: temuan, klaim
  select * into v_found from public.found_reports where found_id = v_found_id for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur serah terima ini.');
  end if;

  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur serah terima atas klaim atau temuan Anda sendiri.');
  end if;

  if v_claim.status <> 'disetujui' or v_found.status <> 'dicadangkan' then
    return public.rpc_error('CONFLICT', 'Jadwal hanya dapat dibuat untuk klaim yang berstatus Disetujui.');
  end if;

  if exists (
    select 1 from public.handover_schedules
    where claim_id = p_claim_id and status = 'terjadwal'
  ) then
    return public.rpc_error('CONFLICT', 'Klaim ini sudah memiliki jadwal aktif. Ubah atau batalkan jadwal tersebut.');
  end if;

  begin
    insert into public.handover_schedules (claim_id, waktu, lokasi, catatan)
    values (p_claim_id, p_waktu, v_lokasi, v_catatan)
    returning * into v_sched;
  exception when unique_violation then
    return public.rpc_error('CONFLICT', 'Jadwal bersamaan terdeteksi. Muat ulang halaman.');
  end;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', v_sched.schedule_id, 'jadwal_dibuat', null);

  v_pesan := 'Jadwal serah terima barang "' || v_found.kategori || '" ditetapkan pada '
    || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB di ' || v_lokasi || '.';

  perform public.internal_notify(v_claim.user_id, 'jadwal_dibuat', v_pesan);
  perform public.internal_notify(v_found.user_id, 'jadwal_dibuat', v_pesan);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', v_sched.schedule_id,
    'status', v_sched.status
  ));
end;
$function$
;

-- rpc_error (p_code text, p_message text) | SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.rpc_error(p_code text, p_message text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', p_code, 'message', p_message)
  );
$function$
;

-- rpc_reject_claim (p_claim_id uuid, p_alasan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_reject_claim(p_claim_id uuid, p_alasan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if p_claim_id is null or char_length(v_alasan) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Alasan penolakan wajib diisi, 3 sampai 1000 karakter.');
  end if;

  select found_id into v_found_id from public.claims where claim_id = p_claim_id;
  if not found then
    return public.rpc_error('VALIDATION', 'Klaim tidak ditemukan.');
  end if;

  -- urutan kunci: temuan, lalu klaim
  select * into v_found from public.found_reports where found_id = v_found_id for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang memutuskan klaim ini.');
  end if;

  select * into v_claim from public.claims where claim_id = p_claim_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh memutuskan klaim yang Anda ajukan atau atas temuan yang Anda laporkan.');
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
    'Klaim Anda atas barang "' || v_found.kategori || '" ditolak. Lihat alasannya pada detail klaim.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', p_claim_id,
    'status', 'ditolak'
  ));
end;
$function$
;

-- rpc_submit_claim (p_found_id uuid, p_ciri_kepemilikan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_submit_claim(p_found_id uuid, p_ciri_kepemilikan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid   uuid := (select auth.uid());
  v_text  text := btrim(coalesce(p_ciri_kepemilikan, ''));
  v_found public.found_reports%rowtype;
  v_claim public.claims%rowtype;
  v_count int;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi. Verifikasi surel terlebih dahulu.');
  end if;

  if p_found_id is null or char_length(v_text) not between 3 and 1000 then
    return public.rpc_error('VALIDATION', 'Uraian ciri kepemilikan harus 3 sampai 1000 karakter.');
  end if;

  -- kunci baris temuan supaya pengajuan bersamaan diproses berurutan
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

  -- pengiriman ulang identik (misalnya klik ganda) mengembalikan klaim yang sudah ada
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

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'claim_id', v_claim.claim_id,
    'status', v_claim.status,
    'tanggal_pengajuan', v_claim.tanggal_pengajuan,
    'duplikat', false
  ));
end;
$function$
;

-- rpc_update_schedule (p_schedule_id uuid, p_waktu timestamp with time zone, p_lokasi text, p_catatan text) | SECURITY DEFINER | search_path=""
CREATE OR REPLACE FUNCTION public.rpc_update_schedule(p_schedule_id uuid, p_waktu timestamp with time zone, p_lokasi text, p_catatan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid      uuid := (select auth.uid());
  v_lokasi   text := btrim(coalesce(p_lokasi, ''));
  v_catatan  text := nullif(btrim(coalesce(p_catatan, '')), '');
  v_claim_id uuid;
  v_found_id uuid;
  v_found    public.found_reports%rowtype;
  v_claim    public.claims%rowtype;
  v_sched    public.handover_schedules%rowtype;
  v_pesan    text;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;

  if not public.is_verified() then
    return public.rpc_error('FORBIDDEN', 'Akun Anda belum terverifikasi.');
  end if;

  if p_schedule_id is null or p_waktu is null
     or char_length(v_lokasi) not between 1 and 200
     or (v_catatan is not null and char_length(v_catatan) > 1000) then
    return public.rpc_error('VALIDATION', 'Waktu wajib diisi, lokasi 1 sampai 200 karakter, catatan maksimal 1000 karakter.');
  end if;

  if p_waktu <= now() then
    return public.rpc_error('VALIDATION', 'Waktu serah terima harus berada di masa depan.');
  end if;

  select h.claim_id, c.found_id into v_claim_id, v_found_id
  from public.handover_schedules h
  join public.claims c on c.claim_id = h.claim_id
  where h.schedule_id = p_schedule_id;

  if not found then
    return public.rpc_error('VALIDATION', 'Jadwal tidak ditemukan.');
  end if;

  -- urutan kunci: temuan, klaim, jadwal
  select * into v_found from public.found_reports where found_id = v_found_id for update;

  if not public.is_admin_for_area(v_found.area_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak berwenang mengatur serah terima ini.');
  end if;

  select * into v_claim from public.claims where claim_id = v_claim_id for update;
  select * into v_sched from public.handover_schedules where schedule_id = p_schedule_id for update;

  if v_uid in (v_claim.user_id, v_found.user_id) then
    return public.rpc_error('FORBIDDEN', 'Anda tidak boleh mengatur serah terima atas klaim atau temuan Anda sendiri.');
  end if;

  if v_sched.status <> 'terjadwal' then
    return public.rpc_error('CONFLICT', 'Jadwal ini sudah selesai atau dibatalkan dan tidak dapat diubah.');
  end if;

  update public.handover_schedules
  set waktu = p_waktu,
      lokasi = v_lokasi,
      catatan = v_catatan
  where schedule_id = p_schedule_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'handover_schedule', p_schedule_id, 'jadwal_diubah', null);

  v_pesan := 'Jadwal serah terima barang "' || v_found.kategori || '" diubah menjadi '
    || to_char(p_waktu at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB di ' || v_lokasi || '.';

  perform public.internal_notify(v_claim.user_id, 'jadwal_diubah', v_pesan);
  perform public.internal_notify(v_found.user_id, 'jadwal_diubah', v_pesan);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'schedule_id', p_schedule_id,
    'status', 'terjadwal'
  ));
end;
$function$
;

-- set_updated_at () | SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

commit;
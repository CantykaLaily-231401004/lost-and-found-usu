begin;

create or replace function public.rpc_admin_assign_faculty(p_email text, p_area_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_area  public.areas%rowtype;
  v_user  public.users%rowtype;
  v_asg   uuid;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_admin_pusat() then
    return public.rpc_error('FORBIDDEN', 'Hanya admin pusat yang dapat menetapkan admin fakultas.');
  end if;

  if v_email = '' then
    return public.rpc_field_error('email', 'Surel akun wajib diisi.');
  end if;
  if v_email !~ '^[^@\s]+@(students\.)?usu\.ac\.id$' then
    return public.rpc_field_error('email', 'Gunakan surel berdomain usu.ac.id atau students.usu.ac.id.');
  end if;

  select * into v_area from public.areas where area_id = p_area_id;
  if not found or v_area.jenis_area <> 'fakultas' then
    return public.rpc_field_error('area_id', 'Pilih area fakultas.');
  end if;

  select * into v_user from public.users where lower(email) = v_email for update;
  if not found then
    return public.rpc_field_error('email', 'Akun dengan surel ini belum terdaftar.');
  end if;
  if v_user.verified_at is null then
    return public.rpc_field_error('email', 'Akun ini belum terverifikasi.');
  end if;
  if v_user.role = 'admin_pusat' then
    return public.rpc_field_error('email', 'Akun ini admin pusat dan tidak dapat dijadikan admin fakultas.');
  end if;
  if exists (select 1 from public.claims
             where user_id = v_user.user_id and status in ('menunggu', 'disetujui')) then
    return public.rpc_field_error('email', 'Akun ini masih punya klaim aktif. Akun admin tidak boleh punya klaim.');
  end if;

  select assignment_id into v_asg from public.penugasan_admin
  where admin_id = v_user.user_id and area_id = p_area_id and status = 'aktif';
  if found then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'assignment_id', v_asg, 'user_id', v_user.user_id, 'email', v_user.email, 'nama', v_user.nama,
      'area_id', p_area_id, 'nama_area', v_area.nama_area, 'duplikat', true));
  end if;

  update public.users set role = 'admin_fakultas' where user_id = v_user.user_id;

  insert into public.penugasan_admin (admin_id, area_id)
  values (v_user.user_id, p_area_id)
  returning assignment_id into v_asg;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'penugasan_admin', v_asg, 'admin_fakultas_ditetapkan', null);

  perform public.internal_notify(
    v_user.user_id, 'peran_admin',
    'Akun Anda ditetapkan sebagai admin fakultas untuk ' || v_area.nama_area || '.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'assignment_id', v_asg, 'user_id', v_user.user_id, 'email', v_user.email, 'nama', v_user.nama,
    'area_id', p_area_id, 'nama_area', v_area.nama_area, 'duplikat', false));
end;
$$;

create or replace function public.rpc_admin_revoke_faculty(p_assignment_id uuid, p_alasan text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_alasan text := btrim(coalesce(p_alasan, ''));
  v_asg    public.penugasan_admin%rowtype;
  v_area   text;
  v_role   text;
begin
  if v_uid is null then
    return public.rpc_error('UNAUTHORIZED', 'Sesi tidak valid. Silakan masuk kembali.');
  end if;
  if not public.is_admin_pusat() then
    return public.rpc_error('FORBIDDEN', 'Hanya admin pusat yang dapat mencabut admin fakultas.');
  end if;
  if char_length(v_alasan) not between 3 and 300 then
    return public.rpc_field_error('alasan', 'Alasan pencabutan wajib diisi, 3 sampai 300 karakter.');
  end if;

  select * into v_asg from public.penugasan_admin where assignment_id = p_assignment_id for update;
  if not found then
    return public.rpc_error('VALIDATION', 'Penugasan tidak ditemukan.');
  end if;
  select nama_area into v_area from public.areas where area_id = v_asg.area_id;

  if v_asg.status = 'dicabut' then
    select role into v_role from public.users where user_id = v_asg.admin_id;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'assignment_id', p_assignment_id, 'status', 'dicabut', 'peran_akun', v_role, 'duplikat', true));
  end if;

  update public.penugasan_admin
  set status = 'dicabut', revoked_at = now()
  where assignment_id = p_assignment_id;

  update public.users
  set role = 'pengguna'
  where user_id = v_asg.admin_id
    and role = 'admin_fakultas'
    and not exists (select 1 from public.penugasan_admin
                    where admin_id = v_asg.admin_id and status = 'aktif');
  select role into v_role from public.users where user_id = v_asg.admin_id;

  insert into public.audit_records (actor_id, object_type, object_id, action, alasan)
  values (v_uid, 'penugasan_admin', p_assignment_id, 'admin_fakultas_dicabut', v_alasan);

  perform public.internal_notify(
    v_asg.admin_id, 'peran_admin',
    'Penugasan Anda sebagai admin fakultas untuk ' || v_area || ' telah dicabut.'
  );

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'assignment_id', p_assignment_id, 'status', 'dicabut', 'peran_akun', v_role, 'duplikat', false));
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
                          'assignment_id', pa.assignment_id, 'area_id', pa.area_id, 'nama_area', a.nama_area, 'status', pa.status,
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

revoke all on function public.rpc_admin_list_accounts() from public, anon, authenticated;
grant execute on function public.rpc_admin_list_accounts() to authenticated;
revoke all on function public.rpc_admin_assign_faculty(text, uuid) from public, anon, authenticated;
grant execute on function public.rpc_admin_assign_faculty(text, uuid) to authenticated;
revoke all on function public.rpc_admin_revoke_faculty(uuid, text) from public, anon, authenticated;
grant execute on function public.rpc_admin_revoke_faculty(uuid, text) to authenticated;

commit;
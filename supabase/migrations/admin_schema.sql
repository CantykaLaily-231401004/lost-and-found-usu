begin;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_records' and column_name = 'area_id'
  ) then
    raise exception 'Kolom audit_records.area_id sudah ada. Migrasi ini sudah pernah dijalankan.';
  end if;
end $$;

alter table public.audit_records
  add column area_id uuid references public.areas (area_id);

create index audit_records_area_idx
  on public.audit_records (area_id, occurred_at desc);

create or replace function public.internal_audit_area(p_object_type text, p_object_id uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select case p_object_type
    when 'found_report' then
      (select f.area_id from public.found_reports f where f.found_id = p_object_id)
    when 'lost_report' then
      (select l.area_id from public.lost_reports l where l.lost_id = p_object_id)
    when 'claim' then
      (select f.area_id
       from public.claims c
       join public.found_reports f on f.found_id = c.found_id
       where c.claim_id = p_object_id)
    when 'handover_schedule' then
      (select f.area_id
       from public.handover_schedules s
       join public.claims c on c.claim_id = s.claim_id
       join public.found_reports f on f.found_id = c.found_id
       where s.schedule_id = p_object_id)
    when 'penugasan_admin' then
      (select pa.area_id from public.penugasan_admin pa where pa.assignment_id = p_object_id)
    else null
  end;
$$;

create or replace function public.set_audit_area()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.area_id is null then
    new.area_id := public.internal_audit_area(new.object_type, new.object_id);
  end if;
  return new;
end;
$$;

create trigger audit_records_set_area
  before insert on public.audit_records
  for each row execute function public.set_audit_area();

create or replace function public.internal_admin_areas()
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when public.is_admin_pusat() then
      array(select a.area_id from public.areas a)
    else
      array(
        select pa.area_id
        from public.penugasan_admin pa
        join public.users u on u.user_id = pa.admin_id
        where pa.admin_id = (select auth.uid())
          and pa.status = 'aktif'
          and u.role = 'admin_fakultas'
          and u.verified_at is not null
      )
  end;
$$;

revoke select on table public.claims from authenticated;
grant select (claim_id, user_id, found_id, ciri_kepemilikan, status, alasan,
              tanggal_pengajuan, decision_at, created_at, updated_at)
  on table public.claims to authenticated;

revoke select on table public.data_rahasia from authenticated;
grant select (secret_id, found_id, ciri_rahasia, created_at, updated_at)
  on table public.data_rahasia to authenticated;

revoke all on function public.internal_audit_area(text, uuid) from public, anon, authenticated;
revoke all on function public.set_audit_area() from public, anon, authenticated;
revoke all on function public.internal_admin_areas() from public, anon, authenticated;

commit;
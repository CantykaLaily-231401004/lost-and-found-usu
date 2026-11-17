begin;

do $$
begin
  if exists (select 1 from public.handover_schedules where status not in ('terjadwal', 'dibatalkan', 'selesai')) then
    raise exception 'Ada jadwal dengan status tidak dikenal. Migrasi dihentikan.';
  end if;
end $$;

alter table public.handover_schedules
  add column penanggung_jawab_id uuid references public.users (user_id),
  add column alasan_batal text,
  add column catatan_pemohon text;

alter table public.handover_schedules
  add constraint handover_schedules_alasan_batal_check
    check (alasan_batal is null or char_length(btrim(alasan_batal)) between 3 and 1000),
  add constraint handover_schedules_catatan_pemohon_check
    check (catatan_pemohon is null or char_length(btrim(catatan_pemohon)) between 1 and 500);

alter table public.handover_schedules drop constraint handover_schedules_status_check;
alter table public.handover_schedules add constraint handover_schedules_status_check
  check (status = any (array['diajukan', 'terjadwal', 'dibatalkan', 'selesai']));

alter table public.handover_schedules alter column lokasi drop not null;
alter table public.handover_schedules add constraint handover_schedules_lokasi_wajib_check
  check (status not in ('terjadwal', 'selesai') or lokasi is not null);

alter table public.handover_schedules add constraint handover_schedules_pj_wajib_check
  check (status not in ('terjadwal', 'selesai') or penanggung_jawab_id is not null);

drop index public.handover_one_active_key;
create unique index handover_one_active_key
  on public.handover_schedules (claim_id)
  where status in ('diajukan', 'terjadwal');

commit;
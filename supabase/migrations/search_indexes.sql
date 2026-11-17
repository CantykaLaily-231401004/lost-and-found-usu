begin;

create extension if not exists pg_trgm with schema extensions;

create index if not exists lost_reports_deskripsi_trgm_idx
  on public.lost_reports using gin (deskripsi extensions.gin_trgm_ops);

create index if not exists lost_reports_merek_trgm_idx
  on public.lost_reports using gin (merek extensions.gin_trgm_ops);

create index if not exists lost_reports_lokasi_trgm_idx
  on public.lost_reports using gin (lokasi_kehilangan extensions.gin_trgm_ops);

create index if not exists lost_reports_warna_trgm_idx
  on public.lost_reports using gin (warna extensions.gin_trgm_ops);

create index if not exists found_reports_deskripsi_trgm_idx
  on public.found_reports using gin (deskripsi extensions.gin_trgm_ops);

create index if not exists found_reports_merek_trgm_idx
  on public.found_reports using gin (merek extensions.gin_trgm_ops);

create index if not exists found_reports_lokasi_trgm_idx
  on public.found_reports using gin (lokasi_temuan extensions.gin_trgm_ops);

create index if not exists found_reports_warna_trgm_idx
  on public.found_reports using gin (warna extensions.gin_trgm_ops);

commit;
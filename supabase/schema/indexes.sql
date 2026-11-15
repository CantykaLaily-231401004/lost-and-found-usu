begin;

set check_function_bodies = false;
set search_path = public, extensions;

CREATE UNIQUE INDEX areas_nama_area_key ON public.areas USING btree (lower(nama_area));
CREATE INDEX audit_records_actor_idx ON public.audit_records USING btree (actor_id);
CREATE INDEX audit_records_object_idx ON public.audit_records USING btree (object_type, object_id, occurred_at DESC);
CREATE UNIQUE INDEX claims_active_pair_key ON public.claims USING btree (user_id, found_id) WHERE (status = ANY (ARRAY['menunggu'::text, 'disetujui'::text]));
CREATE INDEX claims_found_idx ON public.claims USING btree (found_id);
CREATE UNIQUE INDEX claims_one_approved_key ON public.claims USING btree (found_id) WHERE (status = 'disetujui'::text);
CREATE INDEX claims_user_created_idx ON public.claims USING btree (user_id, created_at DESC);
CREATE INDEX found_reports_area_idx ON public.found_reports USING btree (area_id);
CREATE INDEX found_reports_kategori_idx ON public.found_reports USING btree (kategori);
CREATE UNIQUE INDEX found_reports_request_key ON public.found_reports USING btree (user_id, client_request_id) WHERE (client_request_id IS NOT NULL);
CREATE INDEX found_reports_status_created_idx ON public.found_reports USING btree (status, created_at DESC, found_id DESC);
CREATE INDEX found_reports_user_idx ON public.found_reports USING btree (user_id);
CREATE INDEX handover_claim_idx ON public.handover_schedules USING btree (claim_id);
CREATE UNIQUE INDEX handover_one_active_key ON public.handover_schedules USING btree (claim_id) WHERE (status = 'terjadwal'::text);
CREATE INDEX lost_reports_area_idx ON public.lost_reports USING btree (area_id);
CREATE INDEX lost_reports_kategori_idx ON public.lost_reports USING btree (kategori);
CREATE UNIQUE INDEX lost_reports_request_key ON public.lost_reports USING btree (user_id, client_request_id) WHERE (client_request_id IS NOT NULL);
CREATE INDEX lost_reports_status_created_idx ON public.lost_reports USING btree (status, created_at DESC, lost_id DESC);
CREATE INDEX lost_reports_user_idx ON public.lost_reports USING btree (user_id);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, status_baca, created_at DESC);
CREATE INDEX outbox_surel_due_idx ON public.outbox_surel USING btree (status, next_attempt_at);
CREATE UNIQUE INDEX penugasan_admin_aktif_key ON public.penugasan_admin USING btree (admin_id, area_id) WHERE (status = 'aktif'::text);
CREATE INDEX penugasan_admin_area_idx ON public.penugasan_admin USING btree (area_id);
CREATE INDEX photos_found_idx ON public.photos USING btree (found_id);
CREATE INDEX photos_lost_idx ON public.photos USING btree (lost_id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (lower(email));

commit;
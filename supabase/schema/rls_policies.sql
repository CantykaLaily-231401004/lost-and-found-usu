begin;

set check_function_bodies = false;
set search_path = public, extensions;

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_rahasia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.found_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_surel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penugasan_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY areas_select ON public.areas AS PERMISSIVE FOR SELECT TO authenticated USING (is_verified());

CREATE POLICY audit_select ON public.audit_records AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin_pusat());

CREATE POLICY claims_select ON public.claims AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM found_reports f
  WHERE ((f.found_id = claims.found_id) AND is_admin_for_area(f.area_id))))));

CREATE POLICY rahasia_insert ON public.data_rahasia AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM found_reports f
  WHERE ((f.found_id = data_rahasia.found_id) AND (f.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY rahasia_select ON public.data_rahasia AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM found_reports f
  WHERE ((f.found_id = data_rahasia.found_id) AND ((f.user_id = ( SELECT auth.uid() AS uid)) OR is_admin_for_area(f.area_id))))));

CREATE POLICY found_insert ON public.found_reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND is_verified() AND (tanggal_temuan <= now())));

CREATE POLICY found_select ON public.found_reports AS PERMISSIVE FOR SELECT TO authenticated USING (is_verified());

CREATE POLICY found_update_owner ON public.found_reports AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'tersedia'::text) AND (NOT has_active_claim(found_id)))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (tanggal_temuan <= now())));

CREATE POLICY handover_select ON public.handover_schedules AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_handover(claim_id));

CREATE POLICY lost_insert ON public.lost_reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND is_verified() AND (tanggal_kehilangan <= now())));

CREATE POLICY lost_select ON public.lost_reports AS PERMISSIVE FOR SELECT TO authenticated USING (is_verified());

CREATE POLICY lost_update_owner ON public.lost_reports AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'aktif'::text))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (tanggal_kehilangan <= now())));

CREATE POLICY notif_select ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY notif_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY penugasan_select ON public.penugasan_admin AS PERMISSIVE FOR SELECT TO authenticated USING (((admin_id = ( SELECT auth.uid() AS uid)) OR is_admin_pusat()));

CREATE POLICY photos_delete ON public.photos AS PERMISSIVE FOR DELETE TO authenticated USING ((((found_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM found_reports f
  WHERE ((f.found_id = photos.found_id) AND (f.user_id = ( SELECT auth.uid() AS uid)))))) OR ((lost_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM lost_reports l
  WHERE ((l.lost_id = photos.lost_id) AND (l.user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY photos_insert ON public.photos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((storage_path ~~ ((( SELECT auth.uid() AS uid))::text || '/%'::text)) AND (((found_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM found_reports f
  WHERE ((f.found_id = photos.found_id) AND (f.user_id = ( SELECT auth.uid() AS uid)))))) OR ((lost_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM lost_reports l
  WHERE ((l.lost_id = photos.lost_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))))));

CREATE POLICY photos_select ON public.photos AS PERMISSIVE FOR SELECT TO authenticated USING (is_verified());

CREATE POLICY users_select ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin_pusat()));

CREATE POLICY users_update_self ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY photos_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'report-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY photos_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'report-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND is_verified()));

CREATE POLICY photos_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'report-photos'::text) AND is_verified()));

commit;
begin;

set check_function_bodies = false;
set search_path = public, extensions;

CREATE TRIGGER on_auth_email_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.notify_email_confirmed();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_email_change_campus BEFORE UPDATE OF email ON auth.users FOR EACH ROW WHEN (((old.email)::text IS DISTINCT FROM (new.email)::text)) EXECUTE FUNCTION public.enforce_campus_email();
CREATE TRIGGER on_auth_user_enforce_campus_email BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enforce_campus_email();
CREATE TRIGGER on_auth_user_verified AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (((old.email_confirmed_at IS NULL) AND (new.email_confirmed_at IS NOT NULL))) EXECUTE FUNCTION public.handle_user_verified();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER audit_records_immutable BEFORE DELETE OR UPDATE ON public.audit_records FOR EACH ROW EXECUTE FUNCTION public.block_audit_changes();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.data_rahasia FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.found_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.handover_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lost_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outbox_surel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER photos_limit_check BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_limit();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

commit;
begin;

set check_function_bodies = false;
set search_path = public, extensions;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('email-assets', 'email-assets', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('report-photos', 'report-photos', false, 2097152, '{image/jpeg,image/png}') ON CONFLICT (id) DO NOTHING;

commit;
begin;

set check_function_bodies = false;
set search_path = public, extensions;

create table if not exists public.areas (
  area_id uuid DEFAULT gen_random_uuid() NOT NULL,
  nama_area text NOT NULL,
  jenis_area text NOT NULL,
  fakultas_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.audit_records (
  audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  action text NOT NULL,
  alasan text,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address inet,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.claims (
  claim_id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  found_id uuid NOT NULL,
  ciri_kepemilikan text NOT NULL,
  status text DEFAULT 'menunggu'::text NOT NULL,
  alasan text,
  ciri_cocok integer[],
  tanggal_pengajuan timestamp with time zone DEFAULT now() NOT NULL,
  decision_at timestamp with time zone,
  decision_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.data_rahasia (
  secret_id uuid DEFAULT gen_random_uuid() NOT NULL,
  found_id uuid NOT NULL,
  ciri_rahasia text[] NOT NULL,
  catatan_internal text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.found_reports (
  found_id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  area_id uuid NOT NULL,
  client_request_id uuid,
  kategori text NOT NULL,
  deskripsi text NOT NULL,
  warna text,
  merek text,
  lokasi_temuan text NOT NULL,
  tanggal_temuan timestamp with time zone NOT NULL,
  status text DEFAULT 'tersedia'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.handover_schedules (
  schedule_id uuid DEFAULT gen_random_uuid() NOT NULL,
  claim_id uuid NOT NULL,
  waktu timestamp with time zone NOT NULL,
  lokasi text NOT NULL,
  catatan text,
  status text DEFAULT 'terjadwal'::text NOT NULL,
  konfirmasi_pemilik_at timestamp with time zone,
  konfirmasi_penyerah_at timestamp with time zone,
  dicatat_oleh_admin_id uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.lost_reports (
  lost_id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  area_id uuid NOT NULL,
  client_request_id uuid,
  kategori text NOT NULL,
  deskripsi text NOT NULL,
  warna text,
  merek text,
  lokasi_kehilangan text NOT NULL,
  tanggal_kehilangan timestamp with time zone NOT NULL,
  status text DEFAULT 'aktif'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.notifications (
  notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  jenis text NOT NULL,
  pesan text NOT NULL,
  status_baca boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.outbox_surel (
  outbox_id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid,
  recipient_email text NOT NULL,
  event_type text NOT NULL,
  status text DEFAULT 'menunggu'::text NOT NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamp with time zone,
  sent_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.penugasan_admin (
  assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_id uuid NOT NULL,
  area_id uuid NOT NULL,
  status text DEFAULT 'aktif'::text NOT NULL,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  revoked_at timestamp with time zone
);

create table if not exists public.photos (
  photo_id uuid DEFAULT gen_random_uuid() NOT NULL,
  found_id uuid,
  lost_id uuid,
  storage_path text NOT NULL,
  keterangan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public.users (
  user_id uuid NOT NULL,
  nama text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'pengguna'::text NOT NULL,
  fakultas_id text,
  kontak text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

commit;
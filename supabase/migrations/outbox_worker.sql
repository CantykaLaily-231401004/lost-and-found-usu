-- Ekstensi untuk cron dan pemanggilan HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ambil batch surel yang jatuh tempo
create or replace function public.internal_claim_outbox(p_limit int default 20)
returns table (outbox_id uuid, recipient_email text, event_type text,
               pesan text, attempt_count int)
language sql security definer set search_path = ''
as $$
  with due as (
    select o.outbox_id
      from public.outbox_surel o
     where o.status = 'menunggu'
       and o.attempt_count < 4
       and o.next_attempt_at <= now()
     order by o.next_attempt_at
     limit p_limit
     for update skip locked
  ), upd as (
    update public.outbox_surel o
       set next_attempt_at = now() + interval '5 minutes'
      from due
     where o.outbox_id = due.outbox_id
    returning o.outbox_id, o.recipient_email, o.event_type,
              o.attempt_count, o.notification_id
  )
  select upd.outbox_id, upd.recipient_email, upd.event_type,
         coalesce(n.pesan, ''), upd.attempt_count
    from upd left join public.notifications n
      on n.notification_id = upd.notification_id;
$$;

-- Catat hasil kirim: maksimal 4 percobaan, jeda 1 / 4 / 16 menit
create or replace function public.internal_outbox_mark(
  p_outbox_id uuid, p_ok boolean, p_error text default null)
returns void
language sql security definer set search_path = ''
as $$
  update public.outbox_surel
     set attempt_count = attempt_count + 1,
         status = case
                    when p_ok then 'terkirim'
                    when attempt_count + 1 >= 4 then 'gagal'
                    else 'menunggu'
                  end,
         sent_at = case when p_ok then now() else sent_at end,
         last_error = case when p_ok then null
                           else left(coalesce(p_error, 'unknown'), 1000) end,
         next_attempt_at = case
                    when p_ok or attempt_count + 1 >= 4 then null
                    else now() + (interval '1 minute' * power(4, attempt_count))
                  end
   where outbox_id = p_outbox_id;
$$;

-- Hanya service_role (Edge Function) yang boleh memanggil
revoke all on function public.internal_claim_outbox(int) from public, anon, authenticated;
revoke all on function public.internal_outbox_mark(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.internal_claim_outbox(int) to service_role;
grant execute on function public.internal_outbox_mark(uuid, boolean, text) to service_role;
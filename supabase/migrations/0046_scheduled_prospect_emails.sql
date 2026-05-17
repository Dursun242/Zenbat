-- File d'envoi programmée pour le CRM
-- Permet de planifier des emails à 10/heure max (1 toutes les 6 min)
-- Traitement assuré par la Edge Function process-email-queue (pg_cron toutes les 5 min)

create table if not exists public.scheduled_prospect_emails (
  id           uuid        primary key default gen_random_uuid(),
  prospect_id  uuid        not null references public.prospects(id) on delete cascade,
  sujet        text        not null,
  corps        text        not null,
  corps_html   text,
  send_at      timestamptz not null,
  status       text        not null default 'pending'
                check (status in ('pending','sent','error','cancelled')),
  error_msg    text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists sched_emails_pending_idx  on public.scheduled_prospect_emails(send_at, status) where status = 'pending';
create index if not exists sched_emails_prospect_idx on public.scheduled_prospect_emails(prospect_id);

insert into public.schema_migrations (version, label, applied_at)
values ('0046', 'scheduled_prospect_emails', now())
on conflict (version) do nothing;

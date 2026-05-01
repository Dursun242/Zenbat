-- Support tickets : Claude répond en première ligne, l'admin prend le relais via Telegram.
-- Source de vérité = Supabase. Telegram n'est qu'un canal de notification/réponse jetable.
--
-- Flux :
--   1. User ouvre un ticket depuis l'app  → INSERT support_tickets + premier message (role='user')
--   2. Claude répond automatiquement      → INSERT support_messages (role='claude')
--   3. Si user clique "contacter support" → UPDATE status='awaiting_admin' + notif Telegram à l'admin
--   4. Admin répond via /reply <id>       → INSERT support_messages (role='admin') depuis le bot Telegram
--   5. User valide la résolution          → UPDATE status='resolved'

create table if not exists support_tickets (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  status          text        not null default 'open'
                              check (status in ('open', 'awaiting_admin', 'resolved')),
  subject         text,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at     timestamptz
);

create table if not exists support_messages (
  id         uuid        primary key default gen_random_uuid(),
  ticket_id  uuid        not null references support_tickets(id) on delete cascade,
  role       text        not null check (role in ('user', 'claude', 'admin')),
  content    text        not null check (length(content) > 0 and length(content) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on support_tickets (user_id, last_message_at desc);

create index if not exists support_tickets_status_idx
  on support_tickets (status, last_message_at desc)
  where status <> 'resolved';

create index if not exists support_messages_ticket_idx
  on support_messages (ticket_id, created_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- L'admin passe via service_role (bypass RLS) — pas de policy admin nécessaire.

alter table support_tickets  enable row level security;
alter table support_messages enable row level security;

-- Tickets : l'utilisateur ne voit que les siens et peut en créer.
create policy "user reads own tickets" on support_tickets
  for select to authenticated
  using (auth.uid() = user_id);

create policy "user creates own tickets" on support_tickets
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user updates own tickets" on support_tickets
  for update to authenticated
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- Messages : l'utilisateur lit ceux de ses tickets, et n'insère que ses propres messages (role='user').
-- Les messages role='claude' / role='admin' sont insérés via service_role par les API.
create policy "user reads own ticket messages" on support_messages
  for select to authenticated
  using (exists (
    select 1 from support_tickets t
    where t.id = support_messages.ticket_id
      and t.user_id = auth.uid()
  ));

create policy "user inserts own user messages" on support_messages
  for insert to authenticated
  with check (
    role = 'user'
    and exists (
      select 1 from support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

-- ─── Trigger : maintenir support_tickets.last_message_at à jour ──────────
-- Le statut est laissé à la logique applicative (l'utilisateur peut continuer
-- de discuter avec Claude sans escalader, l'admin gère la résolution, etc.).

create or replace function support_messages_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update support_tickets
     set last_message_at = new.created_at
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket_trg on support_messages;
create trigger support_messages_touch_ticket_trg
  after insert on support_messages
  for each row execute function support_messages_touch_ticket();

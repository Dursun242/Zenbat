-- Ajoute le lien Google Business (Google My Business) sur les prospects CRM
alter table public.prospects
  add column if not exists google_business_url text;

insert into public.schema_migrations (version, label, applied_at)
values ('0045', 'crm_google_business_url', now())
on conflict (version) do nothing;

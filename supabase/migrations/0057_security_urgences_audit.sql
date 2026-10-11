-- ═══════════════════════════════════════════════════════════════════
-- 0057 — Correctifs de sécurité urgents (audit du 2026-10-11)
--
-- 1. profiles : un utilisateur connecté pouvait se passer lui-même en
--    Pro depuis la console du navigateur :
--      supabase.from('profiles').update({ plan: 'pro' }).eq('id', monId)
--    La policy profiles_update_self (0001) ne filtre aucune colonne.
--    → Trigger BEFORE UPDATE qui refuse toute modification des colonnes
--      d'abonnement / de facturation / de compteur quand la requête vient
--      directement du navigateur (rôles anon / authenticated).
--      Le service_role (API Vercel, webhook Stripe, bot Telegram), le SQL
--      Editor (postgres) et les fonctions SECURITY DEFINER (increment_ai_used,
--      expire_pro_trials) ne sont pas concernés : current_user y vaut
--      service_role / postgres.
--      Les colonnes sont lues via to_jsonb() : pas d'erreur si l'une
--      d'elles n'existe pas sur une installation incomplète.
--
-- 2. Tables du CRM de prospection (0044, 0046) créées sans RLS : lisibles
--    et modifiables avec la seule clé anon publique (données personnelles
--    des prospects, file de mails envoyée depuis le domaine Zenbat).
--    → RLS activée sans aucune policy : seuls le service_role (api/crm.js,
--      Edge Function process-email-queue) y accède, comme aujourd'hui.
--
-- 3. Fonctions réservées au service_role / pg_cron : `revoke ... from public`
--    ne suffit pas sur Supabase, qui accorde EXECUTE explicitement à anon
--    et authenticated (cf. 0051). On retire ces droits.
--
-- 4. create_avoir_from() recopiait aussi les lignes supprimées
--    (soft-delete) de la facture d'origine → avoir avec lignes en double.
--
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colonnes protégées de profiles ──────────────────────────────
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c text;
  protected text[] := array[
    'id', 'plan', 'ai_used', 'pro_until', 'billing_cycle',
    'stripe_customer_id', 'stripe_subscription_id',
    'welcome_tuto_resent_at', 'created_at'
  ];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  foreach c in array protected loop
    if (to_jsonb(new) -> c) is distinct from (to_jsonb(old) -> c) then
      raise exception 'La colonne profiles.% ne peut pas être modifiée depuis l''application.', c
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists t_profiles_protect_columns on public.profiles;
create trigger t_profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ─── 2. RLS sur les tables du CRM de prospection ────────────────────
alter table if exists public.prospects                 enable row level security;
alter table if exists public.prospect_emails           enable row level security;
alter table if exists public.scheduled_prospect_emails enable row level security;

-- ─── 3. Fonctions service_role / pg_cron uniquement ─────────────────
revoke all on function public.run_retention_purge()           from public, anon, authenticated;
revoke all on function public.purge_old_support_tickets()     from public, anon, authenticated;
revoke all on function public.admin_login_history(integer)    from public, anon, authenticated;
revoke all on function public.expire_pro_trials()             from public, anon, authenticated;

-- ─── 4. create_avoir_from() : ignorer les lignes supprimées ─────────
-- Reprise à l'identique de 0038, seul le filtre deleted_at est ajouté.
create or replace function public.create_avoir_from(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src     public.invoices%rowtype;
  v_new_id  uuid;
  v_numero  text;
begin
  select * into v_src
    from public.invoices
   where id = p_invoice_id and owner_id = auth.uid();
  if not found then
    raise exception 'Facture introuvable ou accès refusé.';
  end if;

  if v_src.deleted_at is not null then
    raise exception 'Cette facture a été supprimée.';
  end if;
  if v_src.avoir_of_invoice_id is not null then
    raise exception 'On ne peut pas créer un avoir à partir d''un avoir.';
  end if;

  v_numero := public.next_invoice_number(extract(year from now())::int);

  insert into public.invoices (
    owner_id, client_id, numero, objet, operation_type,
    statut, locked,
    montant_ht, montant_tva, montant_ttc,
    retenue_garantie_pct, retenue_garantie_eur,
    date_emission, date_echeance,
    ville_chantier, notes,
    avoir_of_invoice_id,
    auto_liquidation_btp
  ) values (
    v_src.owner_id, v_src.client_id, v_numero,
    'Avoir sur ' || v_src.numero || coalesce(' — ' || v_src.objet, ''),
    v_src.operation_type,
    'brouillon', false,
    v_src.montant_ht, v_src.montant_tva, v_src.montant_ttc,
    v_src.retenue_garantie_pct, v_src.retenue_garantie_eur,
    current_date, null,
    v_src.ville_chantier,
    'Avoir émis en rectification de la facture ' || v_src.numero || '.',
    v_src.id,
    v_src.auto_liquidation_btp
  )
  returning id into v_new_id;

  -- Copie des lignes actives (mêmes quantités ; l'utilisateur ajustera si besoin)
  insert into public.lignes_invoices (
    invoice_id, owner_id, position, type_ligne,
    lot, designation, unite, quantite, prix_unitaire, tva_rate
  )
  select
    v_new_id, l.owner_id, l.position, l.type_ligne,
    l.lot, l.designation, l.unite,
    l.quantite, l.prix_unitaire, l.tva_rate
  from public.lignes_invoices l
  where l.invoice_id = v_src.id
    and l.deleted_at is null;

  return v_new_id;
end;
$$;

-- ─── Vérifications (à lancer après application) ─────────────────────
--   select has_function_privilege('anon', 'public.admin_login_history(integer)', 'execute');  -- false
--   select relname, relrowsecurity from pg_class
--    where relname in ('prospects','prospect_emails','scheduled_prospect_emails');           -- true ×3
--   Depuis l'app (console navigateur, connecté) :
--   await supabase.from('profiles').update({ plan: 'pro' }).eq('id', '<mon id>')            -- erreur 42501

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0057', 'security_urgences_audit', now())
on conflict (version) do nothing;

-- Page publique client : token, suivi acceptation, OTP, audit, négociation

-- ── Colonnes sur devis ─────────────────────────────────────────────────────
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS public_token       uuid DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS sent_to_client_at  timestamptz,
  ADD COLUMN IF NOT EXISTS client_name        text,
  ADD COLUMN IF NOT EXISTS client_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_refused_at  timestamptz,
  ADD COLUMN IF NOT EXISTS client_refusal_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS devis_public_token_idx ON public.devis(public_token);

-- ── Sessions OTP (vérification identité client) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.devis_otp_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token uuid        NOT NULL,
  email_hash   text        NOT NULL,
  otp_hash     text        NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_token_idx ON public.devis_otp_sessions(public_token, created_at DESC);

ALTER TABLE public.devis_otp_sessions ENABLE ROW LEVEL SECURITY;
-- Accès service_role uniquement (pas de lecture directe depuis le client)

-- ── Journal d'activité par devis ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devis_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id    uuid        NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  event       text        NOT NULL,
  -- 'sent' | 'opened' | 'accepted' | 'refused' | 'negotiation_sent' | 'artisan_responded'
  from_party  text,       -- 'artisan' | 'client' | 'system'
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_devis_idx ON public.devis_audit_log(devis_id, created_at DESC);

ALTER TABLE public.devis_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read audit" ON public.devis_audit_log;
CREATE POLICY "owner read audit" ON public.devis_audit_log
  FOR SELECT
  USING (
    devis_id IN (SELECT id FROM public.devis WHERE owner_id = auth.uid())
  );

-- ── Rounds de négociation ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devis_negotiations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id      uuid        NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  round         integer     NOT NULL DEFAULT 1,
  from_party    text        NOT NULL,   -- 'client' | 'artisan'
  message       text,
  line_changes  jsonb,
  -- [{ligne_id, action:'remove'|'change_qty', new_qty, comment}]
  budget_target numeric,
  status        text        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'rejected' | 'superseded'
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS neg_devis_idx ON public.devis_negotiations(devis_id, created_at DESC);

ALTER TABLE public.devis_negotiations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read negotiations" ON public.devis_negotiations;
CREATE POLICY "owner read negotiations" ON public.devis_negotiations
  FOR SELECT
  USING (
    devis_id IN (SELECT id FROM public.devis WHERE owner_id = auth.uid())
  );

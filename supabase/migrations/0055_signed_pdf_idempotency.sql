-- Migration 0055 : verrou d'idempotence sur l'envoi du PDF signé.
--
-- L'action send_signed_pdf de api/devis-public.js se protégeait des
-- doubles envois par un SELECT count préalable — inefficace en cas de
-- requêtes simultanées (double-clic, retry réseau) : les deux passaient
-- le count == 0 et envoyaient chacune les emails.
--
-- On pose un index unique PARTIEL : au plus un événement 'signed_pdf_sent'
-- par devis. L'API insère ce log AVANT l'envoi ; un 2e appel concurrent
-- échoue alors en 23505 et sort sans ré-envoyer. L'index est partiel pour
-- ne PAS contraindre les autres événements (sent, opened, accepted…) qui
-- peuvent légitimement apparaître plusieurs fois pour un même devis.

-- Déduplique d'éventuels 'signed_pdf_sent' multiples créés par le bug
-- avant cette migration (sinon la création de l'index unique échoue).
-- On conserve la ligne la plus ancienne par devis.
delete from public.devis_audit_log a
 using public.devis_audit_log b
 where a.event = 'signed_pdf_sent'
   and b.event = 'signed_pdf_sent'
   and a.devis_id = b.devis_id
   and (a.created_at > b.created_at
        or (a.created_at = b.created_at and a.id > b.id));

create unique index if not exists devis_audit_log_signed_pdf_once
  on public.devis_audit_log (devis_id)
  where event = 'signed_pdf_sent';

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0055', 'signed_pdf_idempotency', now())
on conflict (version) do nothing;

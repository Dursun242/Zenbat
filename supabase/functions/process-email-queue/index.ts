// process-email-queue — traite la file d'envoi programmée CRM
//
// Déclenchement : pg_cron toutes les 5 minutes (voir migration 0046 instructions)
// Auth : verify_jwt = false (déployer avec --no-verify-jwt), MAIS en-tête
//        obligatoire : « Authorization: Bearer <CRON_SECRET> » (secret de la
//        fonction) ou la clé service_role. Sans lui, n'importe qui sur Internet
//        pouvait déclencher la file (l'URL est publique).
//
// Variables d'env requises (Supabase Dashboard → Settings → Edge Functions secrets) :
//   RESEND_API_KEY      — clé Resend (déjà présente pour welcome-email)
//   RESEND_FROM         — ex: "Dursun <zenbat76@gmail.com>"
//   SUPABASE_URL        — injecté automatiquement
//   SUPABASE_SERVICE_ROLE_KEY — injecté automatiquement
//
// Setup pg_cron (SQL Editor Supabase — à faire une fois) :
//   1. Dashboard → Database → Extensions → activer "pg_cron" et "pg_net"
//   2. Exécuter dans SQL Editor :
//      select cron.schedule(
//        'process-email-queue',
//        '*/5 * * * *',
//        $$
//        select net.http_post(
//          url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-email-queue',
//          headers := '{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
//          body := '{}'::jsonb
//        );
//        $$
//      );
//   Remplacer <PROJECT_REF> par votre ref Supabase (visible dans l'URL du dashboard).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 10

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret  = Deno.env.get('CRON_SECRET') ?? ''
  const auth  = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!sameSecret(token, cronSecret) && !sameSecret(token, serviceKey)) {
    console.warn('[process-email-queue] appel refusé : en-tête Authorization absent ou invalide')
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  const resendKey   = Deno.env.get('RESEND_API_KEY')
  const fromAddr    = Deno.env.get('RESEND_FROM') || 'Dursun <zenbat76@gmail.com>'

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY manquante' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const db  = createClient(supabaseUrl, serviceKey)
  const now = new Date().toISOString()

  // Charge les emails en attente dont l'heure d'envoi est passée
  const { data: rows, error: fetchErr } = await db
    .from('scheduled_prospect_emails')
    .select('id, prospect_id, sujet, corps, corps_html, prospects!inner(nom, email, statut)')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: { id: string; status: string; reason?: string }[] = []

  for (const row of rows ?? []) {
    const prospect = row.prospects as { nom: string; email: string; statut: string }
    const sentAt   = new Date().toISOString()

    if (!prospect?.email) {
      await db.from('scheduled_prospect_emails')
        .update({ status: 'error', error_msg: 'Prospect sans email', sent_at: sentAt })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'error', reason: 'no email' })
      continue
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    fromAddr,
          to:      [prospect.email],
          subject: row.sujet,
          html:    row.corps_html || row.corps,
        }),
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Resend ${res.status}: ${txt}`)
      }

      await Promise.all([
        db.from('scheduled_prospect_emails')
          .update({ status: 'sent', sent_at: sentAt })
          .eq('id', row.id),
        db.from('prospect_emails')
          .insert({ prospect_id: row.prospect_id, sujet: row.sujet, corps: row.corps }),
        ...(prospect.statut === 'a_contacter' ? [
          db.from('prospects')
            .update({ statut: 'contacte', updated_at: sentAt })
            .eq('id', row.prospect_id),
        ] : []),
      ])

      results.push({ id: row.id, status: 'sent' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      await db.from('scheduled_prospect_emails')
        .update({ status: 'error', error_msg: msg, sent_at: sentAt })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'error', reason: msg })
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, ok: results.filter(r => r.status === 'sent').length, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

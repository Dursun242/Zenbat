import { supabase } from './supabase'

async function withRetry(fn, retries = 2, delay = 700) {
  try {
    return await fn()
  } catch (err) {
    if (retries <= 0) throw err
    await new Promise(r => setTimeout(r, delay))
    return withRetry(fn, retries - 1, delay * 2)
  }
}

// Normalise une ligne avant insertion (valeurs par défaut, champs requis)
function normalizeRow(r) {
  return {
    ...r,
    designation: r.designation || '—',
    type_ligne:  r.type_ligne  || 'ouvrage',
  }
}

async function insertLignesRows(rows) {
  const valid = rows.map(normalizeRow)

  // Tentative 1 : insertion batch complète
  const { error } = await supabase.from('lignes_devis').insert(valid)
  if (!error) return

  // Tentative 2 : colonne tva_rate manquante (migration 0002 non appliquée)
  if (error.code === '42703' || error.message?.includes('tva_rate')) {
    const noTva = valid.map(({ tva_rate, ...r }) => r)
    const { error: e2 } = await supabase.from('lignes_devis').insert(noTva)
    if (!e2) return
  }

  // Tentative 3 : insertion ligne par ligne pour sauver un maximum
  let lastError = null
  for (const row of valid) {
    const { error: e } = await supabase.from('lignes_devis').insert(row)
    if (!e) continue
    const { tva_rate, ...rowNoTva } = row
    const { error: e2 } = await supabase.from('lignes_devis').insert(rowNoTva)
    if (e2) lastError = e2
  }
  if (lastError) throw lastError
}

// =========================================================
// PROFILES
// =========================================================
export async function getMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateMyProfile(patch) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveBrandData(brandData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const full_name    = `${brandData.firstName || ""} ${brandData.lastName || ""}`.trim() || null
  const company_name = brandData.companyName || null
  const { error } = await supabase
    .from('profiles')
    .update({ brand_data: brandData, full_name, company_name })
    .eq('id', user.id)
  if (error) throw error
}

// =========================================================
// CLIENTS
// =========================================================
export async function listClients() {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data
  })
}

export async function createClient(client) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...client, owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(id, patch) {
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

// =========================================================
// DEVIS (+ lignes)
// =========================================================
export async function listDevis() {
  const { data, error } = await supabase
    .from('devis')
    .select('*, client:clients(*)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Liste les devis + leurs lignes en 2 requêtes (évite N+1)
export async function listDevisWithLignes() {
  const [{ data: ds, error: e1 }, { data: ls }] = await Promise.all([
    supabase.from('devis').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('lignes_devis').select('*').order('position', { ascending: true }),
  ])
  if (e1) throw e1
  // Si lignes échouent (ex: colonne manquante), on retourne quand même les devis
  const byDevis = new Map()
  for (const l of ls || []) {
    if (!byDevis.has(l.devis_id)) byDevis.set(l.devis_id, [])
    byDevis.get(l.devis_id).push(l)
  }
  return (ds || []).map(d => ({ ...d, lignes: byDevis.get(d.id) || [] }))
}

export async function getDevis(id) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('devis')
      .select('*, client:clients(*), lignes:lignes_devis(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    data.lignes?.sort((a, b) => a.position - b.position)
    return data
  })
}

function nextIndiceLetter(usedLetters) {
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!usedLetters.includes(c)) return c;
  }
  return 'A';
}

export async function createIndiceDevis(source) {
  const { data: { user } } = await supabase.auth.getUser();
  const rootId     = source.root_devis_id || source.id;
  const baseNumero = source.numero.replace(/ [A-Z]$/, '');

  // Récupère les lettres déjà utilisées dans ce groupe
  const { data: existing } = await supabase
    .from('devis')
    .select('indice')
    .or(`id.eq.${rootId},root_devis_id.eq.${rootId}`)
    .not('indice', 'is', null);
  const usedLetters = (existing || []).map(d => d.indice).filter(Boolean);
  const nextLetter  = nextIndiceLetter(usedLetters);

  // Crée le nouvel indice
  const { data: created, error } = await supabase
    .from('devis')
    .insert({
      owner_id:       user.id,
      root_devis_id:  rootId,
      indice:         nextLetter,
      numero:         `${baseNumero} ${nextLetter}`,
      objet:          source.objet,
      client_id:      source.client_id,
      ville_chantier: source.ville_chantier,
      statut:         'brouillon',
      montant_ht:     source.montant_ht,
      tva_rate:       source.tva_rate,
      date_emission:  new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) throw error;

  // Copie les lignes depuis la source
  if (source.lignes?.length) {
    const rows = source.lignes.map((l, i) => ({
      devis_id:     created.id,
      owner_id:     user.id,
      position:     l.position ?? i,
      type_ligne:   l.type_ligne,
      lot:          l.lot ?? null,
      designation:  l.designation,
      unite:        l.unite ?? null,
      quantite:     l.quantite ?? 0,
      prix_unitaire:l.prix_unitaire ?? 0,
      tva_rate:     l.tva_rate ?? 20,
    }));
    await supabase.from('lignes_devis').insert(rows);
  }

  // Passe la version active précédente en "remplace"
  await supabase
    .from('devis')
    .update({ statut: 'remplace' })
    .eq('id', source.id)
    .neq('statut', 'remplace');

  return { ...created, lignes: (source.lignes || []).map(l => ({ ...l })) };
}

export async function createDevis(devis, lignes = []) {
  const { data: { user } } = await supabase.auth.getUser()
  let payload = { ...devis, owner_id: user.id }
  let d, error
  // Retry jusqu'à 10× en cas de collision sur le numéro unique (owner_id, numero)
  for (let attempt = 0; attempt < 10; attempt++) {
    ;({ data: d, error } = await supabase.from('devis').insert(payload).select().single())
    if (!error) break
    if (error.code !== '23505') throw error
    // Incrémente le numéro et réessaie : DEV-2026-0003 → DEV-2026-0004
    const match = payload.numero?.match(/^(.*-)(\d+)$/)
    payload = { ...payload, numero: match
      ? `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, '0')}`
      : `${payload.numero || 'DEV'}-${attempt + 2}` }
  }
  if (error) throw error

  if (lignes.length) {
    const rows = lignes.map((l, i) => ({
      devis_id: d.id,
      owner_id: user.id,
      position: l.position ?? i,
      type_ligne: l.type_ligne,
      lot: l.lot ?? null,
      designation: l.designation,
      unite: l.unite ?? null,
      quantite: l.quantite ?? 0,
      prix_unitaire: l.prix_unitaire ?? 0,
      tva_rate: l.tva_rate ?? 20,
    }))
    await insertLignesRows(rows)
  }
  return d
}

export async function updateDevis(id, patch) {
  const { data, error } = await supabase
    .from('devis').update(patch).eq('id', id).select().single()
  if (!error) return data
  // Fallback : colonne inexistante (migration 0007 pas appliquée). On retire
  // les champs optionnels ajoutés tardivement et on retente.
  if (error.code === '42703') {
    const { signed_at, signed_by, odoo_sign_url, odoo_sign_id, ...safe } = patch
    const { data: d2, error: e2 } = await supabase
      .from('devis').update(safe).eq('id', id).select().single()
    if (!e2) return d2
    throw e2
  }
  throw error
}

export async function replaceLignes(devisId, lignes) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error: e1 } = await supabase.from('lignes_devis').delete().eq('devis_id', devisId)
  if (e1) throw e1
  if (!lignes.length) return []
  const rows = lignes.map((l, i) => ({
    devis_id: devisId,
    owner_id: user.id,
    position: l.position ?? i,
    type_ligne: l.type_ligne,
    lot: l.lot ?? null,
    designation: l.designation,
    unite: l.unite ?? null,
    quantite: l.quantite ?? 0,
    prix_unitaire: l.prix_unitaire ?? 0,
    tva_rate: l.tva_rate ?? 20,
  }))
  await insertLignesRows(rows)
  const { data: inserted } = await supabase.from('lignes_devis').select('*').eq('devis_id', devisId).order('position')
  return inserted || []
}

export async function deleteDevis(id) {
  // Conformité : un devis 'accepte' ou 'en_signature' = contrat (code civ.).
  // On lit d'abord le statut pour choisir hard-delete ou soft-delete.
  const { data: row, error: readErr } = await supabase
    .from('devis').select('statut').eq('id', id).maybeSingle()
  if (readErr) throw readErr
  if (!row) return // déjà supprimé / introuvable

  if (row.statut === 'accepte' || row.statut === 'en_signature') {
    throw new Error("Ce devis est lié à un contrat en cours et ne peut pas être supprimé. Marquez-le comme 'refusé' pour pouvoir le supprimer ensuite.")
  }

  if (row.statut === 'envoye') {
    // Soft-delete : trace conservée pour litiges / audit.
    const { error } = await supabase.rpc('soft_delete_devis', { p_id: id })
    if (error) throw error
    return
  }

  // brouillon / refuse → hard-delete (pas de valeur juridique).
  const { error } = await supabase.from('devis').delete().eq('id', id)
  if (error) throw error
}

// =========================================================
// INVOICES (factures électroniques B2Brouter)
// =========================================================
export async function listInvoices() {
  return withRetry(async () => {
    const [{ data: inv, error: e1 }, { data: ls }] = await Promise.all([
      supabase.from('invoices').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('lignes_invoices').select('*').order('position'),
    ])
    if (e1) throw e1
    const byInvoice = new Map()
    for (const l of ls || []) {
      if (!byInvoice.has(l.invoice_id)) byInvoice.set(l.invoice_id, [])
      byInvoice.get(l.invoice_id).push(l)
    }
    return (inv || []).map(i => ({ ...i, lignes: byInvoice.get(i.id) || [] }))
  })
}

export async function nextInvoiceNumber() {
  const { data, error } = await supabase.rpc('next_invoice_number')
  if (error) throw error
  return data
}

export async function createAcompteFromDevis(devis, montantHT, tvaRate = 20, vatRegime) {
  const numero = await nextInvoiceNumber()
  const effectiveRate = vatRegime === 'franchise' ? 0 : tvaRate
  const montant_tva = Math.round(montantHT * effectiveRate) / 100
  const montant_ttc = montantHT + montant_tva
  const lignes = [{
    type_ligne:    'ouvrage',
    designation:   `Acompte sur devis ${devis.numero}${devis.objet ? ' – ' + devis.objet : ''}`,
    unite:         'forfait',
    quantite:      1,
    prix_unitaire: montantHT,
    tva_rate:      effectiveRate,
  }]
  const invoice = {
    devis_id:       devis.id,
    client_id:      devis.client_id,
    numero,
    objet:          `Acompte – ${devis.objet || devis.numero}`,
    operation_type: 'service',
    statut:         'brouillon',
    invoice_type:   'acompte',
    montant_ht:     montantHT,
    montant_tva,
    montant_ttc,
    date_emission:  new Date().toISOString().split('T')[0],
    date_echeance:  new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  }
  return createInvoice(invoice, lignes)
}

export async function createInvoice(invoice, lignes = []) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({ ...invoice, owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  if (lignes.length) {
    const rows = lignes.map((l, i) => ({
      invoice_id:   inv.id,
      owner_id:     user.id,
      position:     l.position ?? i,
      type_ligne:   l.type_ligne || 'ouvrage',
      lot:          l.lot ?? null,
      designation:  l.designation || '—',
      unite:        l.unite ?? null,
      quantite:     l.quantite ?? 0,
      prix_unitaire:l.prix_unitaire ?? 0,
      tva_rate:     l.tva_rate ?? 20,
    }))
    const { error: e2 } = await supabase.from('lignes_invoices').insert(rows)
    if (e2) throw e2
  }
  return inv
}

export async function updateInvoice(id, patch) {
  if (patch.retenue_garantie_pct !== undefined) {
    const pct = Number(patch.retenue_garantie_pct);
    if (isNaN(pct) || pct < 0 || pct > 10)
      throw new Error("Retenue de garantie invalide (0–10 %)");
  }
  const { data, error } = await supabase
    .from('invoices').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function replaceInvoiceLignes(invoiceId, lignes) {
  const { data: { user } } = await supabase.auth.getUser()
  // Soft-delete des lignes existantes (conformité fiscale — pas de hard-delete)
  const { error: e1 } = await supabase
    .from('lignes_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
  if (e1) throw e1
  if (!lignes.length) return []
  const rows = lignes.map((l, i) => ({
    invoice_id:   invoiceId,
    owner_id:     user.id,
    position:     l.position ?? i,
    type_ligne:   l.type_ligne || 'ouvrage',
    lot:          l.lot ?? null,
    designation:  l.designation || '—',
    unite:        l.unite ?? null,
    quantite:     l.quantite ?? 0,
    prix_unitaire:l.prix_unitaire ?? 0,
    tva_rate:     l.tva_rate ?? 20,
  }))
  const { error } = await supabase.from('lignes_invoices').insert(rows)
  if (error) throw error
  const { data: inserted } = await supabase
    .from('lignes_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('position')
  return inserted || []
}

export async function deleteInvoice(id) {
  // Conformité fiscale FR : conservation 10 ans (LPF art. L102 B).
  // Une facture émise / verrouillée ne peut JAMAIS être hard-supprimée.
  // Un brouillon → hard-delete OK. Sinon → soft-delete via RPC.
  const { data: row, error: readErr } = await supabase
    .from('invoices').select('statut, locked').eq('id', id).maybeSingle()
  if (readErr) throw readErr
  if (!row) return

  if (row.statut === 'brouillon' && !row.locked) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    return
  }

  // Toute facture émise est immuable. On la masque (soft-delete) sans la purger.
  const { error } = await supabase.rpc('soft_delete_invoice', { p_id: id })
  if (error) throw error
}

// Crée un avoir (brouillon, modifiable) à partir d'une facture verrouillée.
// Retourne l'UUID du nouvel avoir — côté client, on navigue ensuite vers lui.
export async function createAvoirFromInvoice(invoiceId) {
  const { data, error } = await supabase.rpc('create_avoir_from', { p_invoice_id: invoiceId })
  if (error) throw error
  return data // UUID du nouvel avoir
}

// Appelle le proxy /api/b2brouter avec l'access_token courant.
async function callB2B(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Session expirée — reconnectez-vous')
  const res = await fetch('/api/b2brouter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `B2Brouter HTTP ${res.status}`)
  return data
}

export const b2b = {
  ensureAccount: (info) => callB2B('ensure_account', info),
  sendInvoice:   (invoice_id) => callB2B('send_invoice', { invoice_id }),
  getStatus:     (b2brouter_id) => callB2B('get_invoice_status', { b2brouter_id }),
  listReceived:  () => callB2B('list_received'),
}

// =========================================================
// STORAGE — PDF de devis (bucket privé devis-pdfs)
// Path conventionnel : {user_id}/{devis_id}.pdf
// =========================================================
export async function uploadDevisPdf(devisId, blob) {
  const { data: { user } } = await supabase.auth.getUser()
  const path = `${user.id}/${devisId}.pdf`
  const { error } = await supabase.storage
    .from('devis-pdfs')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  await updateDevis(devisId, { pdf_path: path })
  return path
}

export async function getDevisPdfUrl(devisId, expiresIn = 3600) {
  const { data: { user } } = await supabase.auth.getUser()
  const path = `${user.id}/${devisId}.pdf`
  const { data, error } = await supabase.storage
    .from('devis-pdfs')
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function saveCguAcceptance(version = "1.0") {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from("profiles")
    .update({ cgu_accepted_at: new Date().toISOString(), cgu_version: version })
    .eq("id", user.id)
    .catch(err => console.warn("[cgu] save error (migration 0008 peut-être pas encore appliquée) :", err.message))
}

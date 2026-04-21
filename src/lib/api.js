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
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Liste les devis + leurs lignes en 2 requêtes (évite N+1)
export async function listDevisWithLignes() {
  const [{ data: ds, error: e1 }, { data: ls }] = await Promise.all([
    supabase.from('devis').select('*').order('created_at', { ascending: false }),
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

export async function createDevis(devis, lignes = []) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: d, error } = await supabase
    .from('devis')
    .insert({ ...devis, owner_id: user.id })
    .select()
    .single()
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
  if (error) throw error
  return data
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
  const { error } = await supabase.from('devis').delete().eq('id', id)
  if (error) throw error
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

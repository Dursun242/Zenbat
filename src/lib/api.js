import { supabase } from './supabase'

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
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
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

export async function getDevis(id) {
  const { data, error } = await supabase
    .from('devis')
    .select('*, client:clients(*), lignes:lignes_devis(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  data.lignes?.sort((a, b) => a.position - b.position)
  return data
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
      ...l, devis_id: d.id, owner_id: user.id, position: l.position ?? i,
    }))
    const { error: e2 } = await supabase.from('lignes_devis').insert(rows)
    if (e2) throw e2
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
  const { error: e1 } = await supabase
    .from('lignes_devis').delete().eq('devis_id', devisId)
  if (e1) throw e1
  if (!lignes.length) return []
  const rows = lignes.map((l, i) => ({
    ...l, devis_id: devisId, owner_id: user.id, position: l.position ?? i,
  }))
  const { data, error } = await supabase.from('lignes_devis').insert(rows).select()
  if (error) throw error
  return data
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

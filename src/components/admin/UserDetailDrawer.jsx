import { fmtEur, fmtDT, relTime, SC, SL } from "../../lib/admin/format.js";

// Drawer de détail d'un utilisateur dans le panel admin.
// Présentation pure : reçoit data + callbacks, n'effectue aucun appel réseau.
export default function UserDetailDrawer({
  user, data, loading, error, tab, onTabChange, onClose, onRequestDelete, currentUserId,
}) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90, animation: "fadeUp .15s ease both" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#f8fafc", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 720, minHeight: "40vh", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -20px 60px rgba(0,0,0,.35)" }}>

        {/* Header du drawer */}
        <div style={{ background: "#0f172a", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.fullName || user.name}
            </div>
            <div style={{ color: "#64748b", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: user.plan === "pro" ? "rgba(34,197,94,.18)" : "rgba(148,163,184,.18)", color: user.plan === "pro" ? "#4ade80" : "#94a3b8", flexShrink: 0 }}>
            {user.plan === "pro" ? "PRO" : "FREE"}
          </span>
        </div>

        {/* Tabs */}
        {data && (
          <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", overflowX: "auto", flexShrink: 0 }}>
            {[
              { k: "overview",  l: "Vue",            n: null },
              { k: "profil",    l: "Profil",         n: null },
              { k: "devis",     l: "Devis",          n: data.stats.devisTotal },
              { k: "invoices",  l: "Factures",       n: data.stats.invoicesTotal },
              { k: "clients",   l: "Clients",        n: data.stats.clientsTotal },
              { k: "conv",      l: "Conversations",  n: data.stats.conversations },
              { k: "activite",  l: "Activité",       n: (data.activity || []).length || null },
              { k: "issues",    l: "Incidents",      n: data.stats.errors + data.stats.negatives },
            ].map(t => (
              <button key={t.k} onClick={() => onTabChange(t.k)}
                style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t.k ? "#22c55e" : "transparent"}`, padding: "10px 14px", fontSize: 12, fontWeight: 600, color: tab === t.k ? "#0f172a" : "#64748b", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                {t.l}
                {t.n !== null && <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>({t.n})</span>}
              </button>
            ))}
          </div>
        )}

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading && <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Chargement…</div>}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12, color: "#991b1b", fontSize: 12 }}>❌ {error}</div>
          )}

          {data && tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { l: "CA signé",      v: fmtEur(data.stats.caAccepte), c: "#0ea5e9" },
                  { l: "CA en cours",   v: fmtEur(data.stats.caEnCours), c: "#f59e0b" },
                  { l: "Devis",         v: data.stats.devisTotal,         c: "#7c3aed" },
                  { l: "Factures",      v: data.stats.invoicesTotal,      c: "#22c55e" },
                  { l: "Clients",       v: data.stats.clientsTotal,       c: "#374151" },
                  { l: "IA utilisée",   v: `${data.stats.aiUsed}×`,       c: "#ec4899" },
                ].map(m => (
                  <div key={m.l} style={{ background: "white", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.c, marginTop: 2 }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "white", borderRadius: 10, padding: 12, fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
                <div><strong style={{ color: "#0f172a" }}>Inscrit :</strong> {fmtDT(data.user.created_at)}</div>
                <div><strong style={{ color: "#0f172a" }}>Email confirmé :</strong> {data.user.confirmed_at ? fmtDT(data.user.confirmed_at) : "Non"}</div>
                <div><strong style={{ color: "#0f172a" }}>Dernière connexion :</strong> {data.user.last_sign_in_at ? relTime(data.user.last_sign_in_at) : "—"}</div>
                {data.profile?.company_name && <div><strong style={{ color: "#0f172a" }}>Société :</strong> {data.profile.company_name}</div>}
                {data.profile?.brand_data?.trades?.length > 0 && (
                  <div><strong style={{ color: "#0f172a" }}>Métiers :</strong> {data.profile.brand_data.trades.join(", ")}</div>
                )}
                {data.profile?.brand_data?.siret && <div><strong style={{ color: "#0f172a" }}>SIRET :</strong> {data.profile.brand_data.siret}</div>}
                {data.profile?.brand_data?.city && <div><strong style={{ color: "#0f172a" }}>Ville :</strong> {data.profile.brand_data.city}</div>}
                {data.profile?.brand_data?.phone && <div><strong style={{ color: "#0f172a" }}>Téléphone :</strong> {data.profile.brand_data.phone}</div>}
              </div>
              {data.user.id !== currentUserId && (
                <button onClick={onRequestDelete}
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  🗑 Supprimer ce compte définitivement
                </button>
              )}
            </div>
          )}

          {data && tab === "devis" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.devis.length === 0
                ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucun devis.</div>
                : data.devis.map(d => (
                  <div key={d.id} style={{ background: "white", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{d.numero}</div>
                      <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: `${SC[d.statut] || "#94a3b8"}22`, color: SC[d.statut] || "#94a3b8", fontWeight: 700 }}>{SL[d.statut] || d.statut}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{d.objet || "Sans objet"}</div>
                    {d.ville_chantier && <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.ville_chantier}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#64748b" }}>
                      <span>{fmtDT(d.date_emission)}</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmtEur(d.montant_ht)} HT</span>
                    </div>
                    {d.lignes?.length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer" }}>{d.lignes.filter(l => l.type_ligne === "ouvrage").length} ligne(s)</summary>
                        <div style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>
                          {d.lignes.map(l => (
                            <div key={l.id} style={{ padding: "3px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ flex: 1, color: l.type_ligne === "lot" ? "#0f172a" : "#475569", fontWeight: l.type_ligne === "lot" ? 700 : 400 }}>
                                {l.type_ligne === "lot" ? `▸ ${l.designation}` : l.designation}
                              </span>
                              {l.type_ligne === "ouvrage" && (
                                <span style={{ flexShrink: 0 }}>{l.quantite} {l.unite} × {fmtEur(l.prix_unitaire)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
            </div>
          )}

          {data && tab === "invoices" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.invoices.length === 0
                ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucune facture.</div>
                : data.invoices.map(inv => (
                  <div key={inv.id} style={{ background: "white", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{inv.numero}{inv.avoir_of_invoice_id ? " · avoir" : ""}</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {inv.locked && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>🔒</span>}
                        <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: "#f1f5f9", color: "#475569", fontWeight: 700 }}>{inv.statut}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>{inv.objet || "Sans objet"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#64748b" }}>
                      <span>{fmtDT(inv.date_emission)}</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmtEur(inv.montant_ht)} HT · {fmtEur(inv.montant_ttc)} TTC</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {data && tab === "clients" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.clients.length === 0
                ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucun client.</div>
                : data.clients.map(c => (
                  <div key={c.id} style={{ background: "white", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      {c.raison_sociale || `${c.prenom || ""} ${c.nom || ""}`.trim() || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {c.email || "—"}{c.telephone ? ` · ${c.telephone}` : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      {[c.ville, c.type === "entreprise" ? "Entreprise" : "Particulier"].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {data && tab === "conv" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.conversations.length === 0
                ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucune conversation.</div>
                : data.conversations.map(turn => (
                  <div key={turn.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {turn.user_message && (
                      <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: "#0f172a", color: "white", borderRadius: "12px 12px 3px 12px", padding: "7px 11px", fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>{turn.user_message}</div>
                    )}
                    {turn.ai_response && (
                      <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "white", color: "#1e293b", border: "1px solid #f1f5f9", borderRadius: "12px 12px 12px 3px", padding: "7px 11px", fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {turn.ai_response}
                        {turn.had_devis && <span style={{ display: "inline-block", marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "rgba(34,197,94,.12)", color: "#15803d", fontWeight: 700 }}>devis ✓</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: "#cbd5e1", alignSelf: "center" }}>
                      {fmtDT(turn.created_at)} · {new Date(turn.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {data && tab === "profil" && (() => {
            const bd = data.profile?.brand_data || {};
            const row = (label, val) => val ? (
              <div key={label} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12 }}>
                <span style={{ width: 130, flexShrink: 0, color: "#94a3b8", fontWeight: 600 }}>{label}</span>
                <span style={{ color: "#1e293b", wordBreak: "break-word" }}>{val}</span>
              </div>
            ) : null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Identité</div>
                  {row("Société", bd.companyName)}
                  {row("SIRET", bd.siret)}
                  {row("N° TVA", bd.vatNumber)}
                  {row("Régime TVA", bd.vatRegime === "franchise" ? "Franchise en base" : bd.vatRegime === "normal" ? "Régime normal" : bd.vatRegime)}
                  {row("Métiers", Array.isArray(bd.trades) ? bd.trades.join(", ") : null)}
                </div>
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Coordonnées</div>
                  {row("Adresse", bd.address)}
                  {row("CP / Ville", [bd.postalCode, bd.city].filter(Boolean).join(" "))}
                  {row("Téléphone", bd.phone)}
                  {row("Email", bd.email)}
                  {row("Site web", bd.website)}
                </div>
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Apparence PDF</div>
                  {bd.color && (
                    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12, alignItems: "center" }}>
                      <span style={{ width: 130, flexShrink: 0, color: "#94a3b8", fontWeight: 600 }}>Couleur</span>
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: bd.color, border: "1px solid #e2e8f0", flexShrink: 0 }}/>
                      <span style={{ color: "#1e293b" }}>{bd.color}</span>
                    </div>
                  )}
                  {row("Police", bd.fontStyle)}
                  {bd.logo && <div style={{ padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}><img src={bd.logo} alt="logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain", borderRadius: 4, border: "1px solid #e2e8f0" }}/></div>}
                </div>
                <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Paiement & mentions</div>
                  {row("Conditions règlement", bd.paymentTerms)}
                  {row("Coordonnées bancaires", bd.bankDetails)}
                  {row("Mentions légales", bd.legalMentions)}
                  {row("Mention BTP", bd.btpMention)}
                  {row("Mention RGPD", bd.rgpdMention)}
                </div>
              </div>
            );
          })()}

          {data && tab === "activite" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(data.activity || []).length === 0
                ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Aucune activité enregistrée.</div>
                : (data.activity || []).map((a, i) => (
                  <div key={a.id || i} style={{ background: "white", borderRadius: 10, padding: "8px 12px", boxShadow: "0 1px 3px rgba(0,0,0,.04)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: a.action === "DELETE" ? "#ef4444" : a.action === "INSERT" ? "#22c55e" : "#3b82f6", marginTop: 5 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: a.action === "DELETE" ? "#fef2f2" : a.action === "INSERT" ? "#f0fdf4" : "#eff6ff", color: a.action === "DELETE" ? "#b91c1c" : a.action === "INSERT" ? "#15803d" : "#1d4ed8" }}>{a.action}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#0f172a" }}>{a.table_name}</span>
                        {a.record_id && <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>{String(a.record_id).slice(0, 8)}…</span>}
                      </div>
                      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{fmtDT(a.created_at)} · {new Date(a.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {data && tab === "issues" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Erreurs IA ({data.errors.length})</div>
                {data.errors.length === 0 ? <div style={{ fontSize: 11, color: "#94a3b8" }}>Aucune erreur 🎉</div> : data.errors.map(e => (
                  <div key={e.id} style={{ background: "white", borderRadius: 10, padding: "8px 12px", marginBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize: 11, color: "#b91c1c", fontFamily: "ui-monospace,monospace", wordBreak: "break-word" }}>{e.error}</div>
                    {e.user_message && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontStyle: "italic" }}>« {e.user_message.slice(0, 200)}{e.user_message.length > 200 ? "…" : ""} »</div>}
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{fmtDT(e.created_at)}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Réponses négatives ({data.negatives.length})</div>
                {data.negatives.length === 0 ? <div style={{ fontSize: 11, color: "#94a3b8" }}>Aucun signal négatif.</div> : data.negatives.map(n => (
                  <div key={n.id} style={{ background: "white", borderRadius: 10, padding: "8px 12px", marginBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: n.kind === "ai_refusal" ? "#f1f5f9" : "#fef2f2", color: n.kind === "ai_refusal" ? "#475569" : "#b91c1c" }}>
                      {n.kind === "ai_refusal" ? "Refus IA" : "Usager mécontent"}
                    </span>
                    {n.user_message && <div style={{ fontSize: 11, color: "#0f172a", marginTop: 4 }}>« {n.user_message.slice(0, 200)}{n.user_message.length > 200 ? "…" : ""} »</div>}
                    {n.ai_response && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontStyle: "italic" }}>{n.ai_response.slice(0, 200)}{n.ai_response.length > 200 ? "…" : ""}</div>}
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{fmtDT(n.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

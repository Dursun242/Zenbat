import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./lib/auth.jsx";
import {
  listClients, createClient as apiCreateClient, updateClient as apiUpdateClient, deleteClient as apiDeleteClient,
  listDevisWithLignes, getDevis, createDevis as apiCreateDevis, updateDevis as apiUpdateDevis, replaceLignes, deleteDevis as apiDeleteDevis,
  updateMyProfile,
} from "./lib/api";
import { uid } from "./lib/utils.js";
import { DEFAULT_DEMO_BRAND, DEFAULT_BRAND, DEMO_CLIENTS, DEMO_DEVIS } from "./lib/constants.js";

import Logo        from "./components/ui/Logo.jsx";
import { I }       from "./components/ui/icons.jsx";
import Dashboard   from "./components/Dashboard.jsx";
import ClientsList from "./components/ClientsList.jsx";
import ClientDetail from "./components/ClientDetail.jsx";
import DevisList   from "./components/DevisList.jsx";
import DevisDetail from "./components/DevisDetail.jsx";
import AgentIA     from "./components/AgentIA.jsx";
import AdminPanel  from "./components/AdminPanel.jsx";
import Onboarding       from "./pages/Onboarding.jsx";
import AuthScreen       from "./pages/AuthScreen.jsx";
import PaywallScreen    from "./pages/PaywallScreen.jsx";
import PWAInstallScreen from "./pages/PWAInstallScreen.jsx";

const TRIAL_DAYS = 30;

const NAV = [
  { id: "dashboard", label: "Accueil",  icon: I.trend },
  { id: "clients",   label: "Clients",  icon: I.users },
  { id: "devis",     label: "Devis",    icon: I.file  },
  { id: "agent",     label: "Agent IA", icon: I.spark },
];

export default function App() {
  const [screen, setScreen]   = useState("app");
  const [tab,    setTab]      = useState("dashboard");
  const [selD,   setSelD]     = useState(null);
  const [selC,   setSelC]     = useState(null);
  const [plan,   setPlan]     = useState("free");
  const [toast,  setToast]    = useState(null);
  const [loadingDevis, setLoadingDevis] = useState(new Set());
  const [showPwa, setShowPwa] = useState(false);
  const deferredPrompt = useRef(null);

  const [brand, setBrandState] = useState(() => {
    try {
      const stored = localStorage.getItem("zenbat_brand");
      if (stored) return { ...DEFAULT_DEMO_BRAND, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_DEMO_BRAND;
  });

  const setBrand = useCallback((updater) => {
    setBrandState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("zenbat_brand", JSON.stringify(next)); } catch {}
      // Sync identité côté serveur (best-effort, silencieux) : visible dans l'espace admin
      const fullName = `${next.firstName || ""} ${next.lastName || ""}`.trim();
      const prevFull = `${prev.firstName || ""} ${prev.lastName || ""}`.trim();
      if (next.companyName !== prev.companyName || fullName !== prevFull) {
        updateMyProfile({
          company_name: next.companyName || null,
          full_name:    fullName || null,
        }).catch(err => console.warn("[profile sync]", err));
      }
      return next;
    });
  }, []);

  const [clients, setClients] = useState(DEMO_CLIENTS);
  const [devis,   setDevis]   = useState(DEMO_DEVIS);

  const showUndo = useCallback((label, onUndo) => {
    setToast(prev => {
      if (prev?.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => setToast(null), 6000);
      return { label, onUndo, timer };
    });
  }, []);

  const showErr = useCallback((label) => {
    setToast(prev => {
      if (prev?.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => setToast(null), 5000);
      return { label, isError: true, timer };
    });
  }, []);

  const dismissToast = () => setToast(prev => { if (prev?.timer) clearTimeout(prev.timer); return null; });

  const { user, signOut } = useAuth();
  const isAdmin = user?.email === import.meta.env.VITE_ADMIN_EMAIL;

  // Capture l'événement beforeinstallprompt pour Android
  useEffect(() => {
    const handler = e => { e.preventDefault(); deferredPrompt.current = e; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Chargement initial depuis Supabase
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [cs, ds] = await Promise.all([listClients(), listDevisWithLignes()]);
        if (cancelled) return;
        setClients(cs.length ? cs : []);
        setDevis(ds.length ? ds : []);
      } catch (err) {
        console.error("[Zenbat] chargement données :", err);
        if (!cancelled) showErr("Erreur de chargement — vérifiez votre connexion");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Pré-remplissage prénom/nom depuis le "Nom complet" de l'inscription
  // si le profil n'a pas encore été personnalisé.
  useEffect(() => {
    if (!user) return;
    const full = (user.user_metadata?.full_name || "").trim();
    if (!full) return;
    setBrand(prev => {
      if (prev.firstName?.trim() || prev.lastName?.trim()) return prev;
      const parts = full.split(/\s+/);
      return { ...prev, firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
    });
  }, [user?.id, setBrand]);

  // Sauvegarde différée des devis
  const saveTimers = useRef({});
  const scheduleDevisSave = (d, immediate = false, saveLignes = false) => {
    if (!user) return;
    const run = async () => {
      try {
        const { lignes: dl, client, created_at, updated_at, id: _id, ...fields } = d;
        await apiUpdateDevis(d.id, fields);
        if (saveLignes) {
          await replaceLignes(d.id, (dl || []).map(({ id, created_at, ...l }) => l));
        }
      } catch (err) { console.error("[save devis]", err); showErr("Impossible de sauvegarder le devis"); }
    };
    if (immediate) { run(); return; }
    clearTimeout(saveTimers.current[d.id]);
    saveTimers.current[d.id] = setTimeout(run, 800);
  };

  // ── CRUD clients ─────────────────────────────────────────
  const onSaveClient = async (c) => {
    const isNew = !clients.some(x => x.id === c.id);
    setClients(prev => isNew ? [c, ...prev] : prev.map(x => x.id === c.id ? c : x));
    if (!user) return;
    try {
      const { created_at, updated_at, ...fields } = c;
      if (isNew) await apiCreateClient(fields);
      else       await apiUpdateClient(c.id, fields);
    } catch (err) { console.error("[save client]", err); showErr("Impossible de sauvegarder le contact"); }
  };

  const onDeleteClient = async (id) => {
    const victim = clients.find(x => x.id === id);
    const idx    = clients.findIndex(x => x.id === id);
    setClients(prev => prev.filter(x => x.id !== id));
    if (user) apiDeleteClient(id).catch(e => { console.error("[delete client]", e); showErr("Impossible de supprimer le contact"); });
    return { victim, idx };
  };

  const onRestoreClient = (victim, idx) => {
    setClients(prev => { const n = [...prev]; n.splice(Math.min(idx, n.length), 0, victim); return n; });
    if (user) {
      const { created_at, updated_at, ...fields } = victim;
      apiCreateClient(fields).catch(e => console.error("[restore client]", e));
    }
  };

  // ── CRUD devis ────────────────────────────────────────────
  const onSaveDevis = (d, saveLignes = false) => {
    setDevis(prev => prev.map(x => x.id === d.id ? d : x));
    scheduleDevisSave(d, false, saveLignes);
  };

  const onCreateDevis = async (d) => {
    setDevis(prev => [d, ...prev]);
    if (!user) return;
    try {
      const { lignes: dl, client, created_at, updated_at, ...fields } = d;
      const saved = await apiCreateDevis(fields, (dl || []).map(({ id, created_at, ...l }) => l));
      if (dl?.length) {
        const fresh = await getDevis(saved.id);
        if (fresh && !fresh.lignes?.length) {
          await replaceLignes(saved.id, (dl || []).map(({ id, created_at, ...l }) => l));
        }
        if (fresh?.lignes?.length) {
          setDevis(prev => prev.map(x => x.id === d.id ? { ...x, lignes: fresh.lignes } : x));
        }
      }
    } catch (err) { console.error("[create devis]", err); showErr("Erreur lors de l'enregistrement du devis"); }
  };

  const onDeleteDevis = async (id) => {
    setDevis(prev => prev.filter(x => x.id !== id));
    if (user) apiDeleteDevis(id).catch(e => { console.error("[delete devis]", e); showErr("Impossible de supprimer le devis"); });
  };

  // Navigation vers un devis (rechargement depuis DB)
  const goDevis = id => {
    setSelD(id); setTab("devis_detail");
    if (!user) return;
    setLoadingDevis(prev => { const n = new Set(prev); n.add(id); return n; });
    getDevis(id)
      .then(fresh => {
        setLoadingDevis(prev => { const n = new Set(prev); n.delete(id); return n; });
        if (!fresh) return;
        setDevis(prev => prev.map(x => {
          if (x.id !== id) return x;
          const dbLignes    = fresh.lignes    || [];
          const stateLignes = x.lignes        || [];
          if (dbLignes.length > 0)    return { ...x, lignes: dbLignes, montant_ht: fresh.montant_ht ?? x.montant_ht };
          if (stateLignes.length > 0) {
            replaceLignes(id, stateLignes.map(({ id: _, created_at: __, ...l }) => l))
              .catch(err => { console.error("[goDevis] retry lignes:", err); showErr("Erreur de synchronisation des lignes"); });
            return x;
          }
          return { ...x, montant_ht: fresh.montant_ht ?? x.montant_ht };
        }));
      })
      .catch(err => {
        setLoadingDevis(prev => { const n = new Set(prev); n.delete(id); return n; });
        console.error("[goDevis reload]", err);
        showErr("Impossible de charger le devis — vérifiez votre connexion");
      });
  };

  const goClient = id => { setSelC(id); setTab("client_detail"); };

  const handleSignOut = () => {
    if (!window.confirm("Se déconnecter ?")) return;
    setClients([]); setDevis([]); setSelD(null); setSelC(null); setTab("dashboard");
    signOut();
  };

  // Trial
  const trialStart  = user?.created_at ? new Date(user.created_at).getTime() : null;
  const daysLeft    = trialStart !== null ? Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - trialStart) / 86400000)) : TRIAL_DAYS;
  const trialExpired = plan === "free" && daysLeft === 0;

  const stats = {
    clients:  clients.length,
    acceptes: devis.filter(d => d.statut === "accepte").length,
    ca:       devis.filter(d => d.statut === "accepte").reduce((s, d) => s + d.montant_ht, 0),
    enCours:  devis.filter(d => ["envoye", "en_signature"].includes(d.statut)).length,
  };

  const activeNav = NAV.find(n => tab.startsWith(n.id))?.id || "dashboard";

  // ── Écrans hors dashboard ─────────────────────────────────
  if (screen === "auth")       return <AuthScreen onEnter={(co, isSignup) => { setBrand(b => ({ ...b, companyName: co || "" })); setShowPwa(!!isSignup); setScreen("onboarding"); }}/>;
  if (screen === "onboarding") return <Onboarding brand={brand} setBrand={setBrand} onDone={() => setScreen(showPwa ? "pwa_install" : "app")}/>;
  if (screen === "pwa_install") return <PWAInstallScreen deferredPrompt={deferredPrompt.current} onDone={() => { setShowPwa(false); setScreen("app"); }}/>;
  if (screen === "paywall")    return <PaywallScreen daysLeft={daysLeft} onBack={() => setScreen("app")} onSubscribe={() => { setPlan("pro"); setScreen("app"); }}/>;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", height: "100dvh", display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{opacity:0;transform:scale(.92) translateY(6px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .fu{animation:fadeUp .22s ease both}
        .pop{animation:popIn .28s cubic-bezier(.34,1.56,.64,1) both}
        input,textarea,select,button{font-family:inherit}
        input,textarea,select{font-size:max(16px,1em) !important}
      `}</style>

      {/* Header */}
      <header style={{ background: "#0f172a", padding: "calc(10px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 10px calc(18px + env(safe-area-inset-left))", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <Logo size={20} white/>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setTab("admin")} title="Panel Admin"
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, color: "#f59e0b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ⚙ Admin
            </button>
          )}
          <button onClick={() => setScreen("onboarding")}
            style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, color: "#94a3b8", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
            {I.paint} Mon profil
          </button>
          {user && (
            <button onClick={handleSignOut} title="Se déconnecter"
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "5px 8px", display: "flex", alignItems: "center", color: "#ef4444", cursor: "pointer" }}>
              {I.logout}
            </button>
          )}
          {plan === "pro"
            ? <span style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid rgba(34,197,94,.25)" }}>PRO</span>
            : <span style={{ background: daysLeft <= 7 ? "rgba(249,115,22,.15)" : "#1e293b", color: daysLeft <= 7 ? "#fb923c" : "#94a3b8", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, border: daysLeft <= 7 ? "1px solid rgba(249,115,22,.25)" : "none" }}>Essai · {daysLeft}j</span>
          }
        </div>
      </header>

      {/* Bandeau trial expiring */}
      {plan === "free" && daysLeft <= 7 && (
        <button onClick={() => setScreen("paywall")}
          style={{ flexShrink: 0, width: "100%", background: daysLeft === 0 ? "#fef2f2" : "#fff7ed", borderBottom: `1px solid ${daysLeft === 0 ? "#fecaca" : "#fed7aa"}`, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", border: "none", color: daysLeft === 0 ? "#991b1b" : "#9a3412", fontSize: 11, fontWeight: 600 }}>
          {daysLeft === 0 ? "⛔ Période d'essai terminée — passer en Pro" : `⏳ Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai — découvrir Pro`}
        </button>
      )}

      {/* Contenu principal */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        {tab === "dashboard"     && <Dashboard stats={stats} devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} brand={brand}
                                       onOpenProfile={() => setScreen("onboarding")}
                                       onOpenPWAInstall={() => setScreen("pwa_install")}/>}
        {tab === "clients"       && <ClientsList clients={clients} onSave={onSaveClient} onDelete={onDeleteClient} onRestore={onRestoreClient} goClient={goClient} showUndo={showUndo}/>}
        {tab === "client_detail" && selC && (
          <ClientDetail
            c={clients.find(x => x.id === selC)}
            clientDevis={devis.filter(d => d.client_id === selC)}
            onBack={() => setTab("clients")}
            goDevis={goDevis}
            onUpdate={onSaveClient}
            onDelete={async () => { await onDeleteClient(selC); setTab("clients"); }}/>
        )}
        {tab === "devis"         && <DevisList devis={devis} clients={clients} goDevis={goDevis} setTab={setTab}/>}
        {tab === "devis_detail"  && selD && (
          <DevisDetail
            d={devis.find(x => x.id === selD)}
            cl={clients.find(c => c.id === devis.find(x => x.id === selD)?.client_id)}
            onBack={() => setTab("devis")}
            brand={brand}
            onChange={onSaveDevis}
            loading={loadingDevis.has(selD)}/>
        )}
        {tab === "agent"         && (
          <AgentIA
            devis={devis}
            onCreateDevis={onCreateDevis}
            clients={clients}
            onSaveClient={onSaveClient}
            plan={plan}
            trialExpired={trialExpired}
            onPaywall={() => setScreen("paywall")}
            setTab={setTab}
            brand={brand}/>
        )}
        {tab === "admin"         && isAdmin && <AdminPanel onBack={() => setTab("dashboard")}/>}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: 12, right: 12, background: toast.isError ? "#7f1d1d" : "#0f172a", color: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,.25)", zIndex: 100, animation: "fadeUp .18s ease both" }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{toast.label}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {!toast.isError && (
              <button onClick={() => { toast.onUndo?.(); dismissToast(); }}
                style={{ background: "#22c55e", color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Annuler
              </button>
            )}
            <button onClick={dismissToast} style={{ background: "transparent", color: "#94a3b8", border: "none", fontSize: 14, cursor: "pointer", padding: "2px 6px" }}>×</button>
          </div>
        </div>
      )}

      {/* Navigation bas */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, paddingBottom: "env(safe-area-inset-bottom)", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", zIndex: 50 }}>
        {NAV.map(({ id, label, icon }) => {
          const active = activeNav === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: active ? "#22c55e" : "#64748b", position: "relative", cursor: "pointer" }}>
              {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2.5, background: "#22c55e", borderRadius: 2 }}/>}
              <div style={{ position: "relative" }}>
                {icon}
                {id === "agent" && plan === "free" && daysLeft <= 7 && (
                  <span style={{ position: "absolute", top: -4, right: -10, background: daysLeft === 0 ? "#ef4444" : "#f97316", color: "white", fontSize: 8, fontWeight: 700, padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {daysLeft === 0 ? "!" : `${daysLeft}j`}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

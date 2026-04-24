import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./lib/auth.jsx";
import {
  listClients, createClient as apiCreateClient, updateClient as apiUpdateClient, deleteClient as apiDeleteClient,
  listDevisWithLignes, getDevis, createDevis as apiCreateDevis, updateDevis as apiUpdateDevis, replaceLignes, deleteDevis as apiDeleteDevis,
  listInvoices, createInvoice as apiCreateInvoice, updateInvoice as apiUpdateInvoice, replaceInvoiceLignes, deleteInvoice as apiDeleteInvoice, nextInvoiceNumber, createAvoirFromInvoice as apiCreateAvoir,
  updateMyProfile, getMyProfile, saveBrandData,
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
import InvoicesList  from "./components/InvoicesList.jsx";
import InvoiceDetail from "./components/InvoiceDetail.jsx";
import AgentIA     from "./components/AgentIA.jsx";
import AdminPanel  from "./components/AdminPanel.jsx";
import Onboarding       from "./pages/Onboarding.jsx";
import TradesQuickPicker from "./pages/TradesQuickPicker.jsx";
import AuthScreen       from "./pages/AuthScreen.jsx";
import PaywallScreen    from "./pages/PaywallScreen.jsx";
import PWAInstallScreen from "./pages/PWAInstallScreen.jsx";

const TRIAL_DAYS = 30;

const NAV = [
  { id: "dashboard", label: "Accueil",  icon: I.trend },
  { id: "clients",   label: "Clients",  icon: I.users },
  { id: "devis",     label: "Devis",    icon: I.file  },
  { id: "factures",  label: "Factures", icon: I.file  },
  { id: "agent",     label: "Agent IA", icon: I.spark },
];

// Recopie les champs de l'inscription (prénom, nom, société, email de
// connexion) dans le brand si celui-ci est encore vierge. L'email de
// connexion sert d'email pro par défaut — affiché dans l'en-tête des
// devis et transmis au client pour la signature.
function hydrateFromMetadata(user, setBrand) {
  const md = user?.user_metadata || {};
  const explicitFirst = (md.first_name || "").trim();
  const explicitLast  = (md.last_name  || "").trim();
  const full          = (md.full_name  || "").trim();
  const company       = (md.company_name || "").trim();
  const loginEmail    = (user?.email || "").trim();
  if (!explicitFirst && !explicitLast && !full && !company && !loginEmail) return;

  setBrand(prev => {
    const next = { ...prev };
    // Chaque champ est renseigné UNIQUEMENT s'il est vide
    // (on n'écrase jamais une saisie déjà faite par l'utilisateur).
    if (!next.companyName?.trim() && company)   next.companyName = company;
    if (!next.email?.trim()       && loginEmail) next.email       = loginEmail;
    if (!next.firstName?.trim() && !next.lastName?.trim()) {
      if (explicitFirst || explicitLast) {
        next.firstName = explicitFirst;
        next.lastName  = explicitLast;
      } else if (full) {
        const parts = full.split(/\s+/);
        next.firstName = parts[0] || "";
        next.lastName  = parts.slice(1).join(" ");
      }
    }
    return next;
  });
}

export default function App() {
  const [screen, setScreen]   = useState("app");
  const [tab,    setTab]      = useState("dashboard");
  const [selD,   setSelD]     = useState(null);
  const [selC,   setSelC]     = useState(null);
  const [plan,   setPlan]     = useState("free");
  const [toast,  setToast]    = useState(null);
  const [loadingDevis, setLoadingDevis] = useState(new Set());
  const [autoOpenPDF,  setAutoOpenPDF]  = useState(null); // devis id à ouvrir en PDF
  const [showPwa, setShowPwa] = useState(false);
  const deferredPrompt = useRef(null);

  const [brand, setBrandState] = useState(() => {
    try {
      const stored = localStorage.getItem("zenbat_brand");
      if (stored) return { ...DEFAULT_DEMO_BRAND, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_DEMO_BRAND;
  });

  const brandSaveTimer = useRef(null);
  const setBrand = useCallback((updater) => {
    setBrandState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("zenbat_brand", JSON.stringify(next)); } catch {}
      // Sync complète vers Supabase (debounce 600 ms pour ne pas surcharger en cas
      // de saisie rapide dans l'onboarding) — remplace l'ancienne sync partielle.
      clearTimeout(brandSaveTimer.current);
      brandSaveTimer.current = setTimeout(() => {
        saveBrandData(next).catch(err => console.warn("[brand sync]", err));
      }, 600);
      return next;
    });
  }, []);

  const [clients,  setClients]  = useState(DEMO_CLIENTS);
  const [devis,    setDevis]    = useState(DEMO_DEVIS);
  const [invoices, setInvoices] = useState([]);
  const [selI,     setSelI]     = useState(null);

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
  const isAdmin = !!user?.email && !!import.meta.env.VITE_ADMIN_EMAIL &&
    user.email.trim().toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL.trim().toLowerCase();

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
      // Charge les factures séparément : si la migration 0005 n'est pas
      // appliquée, on échoue silencieusement sans bloquer le reste.
      try {
        const inv = await listInvoices();
        if (!cancelled) setInvoices(inv || []);
      } catch (err) {
        if (!cancelled) console.warn("[Zenbat] factures indisponibles :", err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Chargement du profil brand depuis Supabase au login.
  // Supabase est la source de vérité — écrase le localStorage pour que les
  // données survivent à un changement de navigateur / appareil.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyProfile()
      .then(profile => {
        if (cancelled) return;
        if (profile?.brand_data && Object.keys(profile.brand_data).length > 0) {
          const merged = { ...DEFAULT_BRAND, ...profile.brand_data };
          setBrandState(merged);
          try { localStorage.setItem("zenbat_brand", JSON.stringify(merged)); } catch {}
        } else {
          // Nouveau compte (brand_data vide en DB) : on pré-remplit depuis
          // les métadonnées d'inscription (prénom + nom + société) et on
          // redirige vers la sélection des métiers AVANT d'atterrir sur
          // le Dashboard. Fonctionne quel que soit le flow (Signup par
          // email, AuthScreen legacy, OAuth futur…).
          hydrateFromMetadata(user, setBrand);
          setScreen("trades_picker");
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.warn("[brand load]", err);
        // Fallback si Supabase échoue : on tente quand même le pré-remplissage
        hydrateFromMetadata(user, setBrand);
      });
    return () => { cancelled = true; };
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
    if (!user) {
      setDevis(prev => prev.filter(x => x.id !== id));
      return;
    }
    try {
      await apiDeleteDevis(id);
      setDevis(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      console.error("[delete devis]", e);
      showErr(e?.message || "Impossible de supprimer le devis");
    }
  };

  // ── CRUD factures ────────────────────────────────────────
  const goInvoice = id => { setSelI(id); setTab("factures_detail"); };

  const onSaveInvoice = (inv, saveLignes = false) => {
    setInvoices(prev => prev.map(x => x.id === inv.id ? inv : x));
    if (!user) return;
    const { lignes: il, created_at, updated_at, ...fields } = inv;
    apiUpdateInvoice(inv.id, fields).catch(e => { console.error("[save invoice]", e); showErr("Impossible de sauvegarder la facture"); });
    if (saveLignes) {
      replaceInvoiceLignes(inv.id, (il || []).map(({ id, created_at, ...l }) => l))
        .catch(e => { console.error("[save invoice lignes]", e); showErr("Erreur sauvegarde lignes facture"); });
    }
  };

  const onCreateInvoiceFromDevis = async (devisId) => {
    const d = devis.find(x => x.id === devisId);
    if (!d) { showErr("Devis introuvable"); return; }
    try {
      const numero = await nextInvoiceNumber().catch(() => `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`);
      const ouvrages = (d.lignes || []).filter(l => l.type_ligne === "ouvrage");
      const franchise = brand.vatRegime === "franchise";
      const ht  = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
      const tva = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * Number(l.tva_rate ?? (franchise ? 0 : 20)) / 100, 0);
      const saved = await apiCreateInvoice(
        {
          devis_id:       d.id,
          client_id:      d.client_id,
          numero,
          objet:          d.objet,
          operation_type: "service",
          statut:         "brouillon",
          montant_ht:     ht,
          montant_tva:    tva,
          montant_ttc:    ht + tva,
          ville_chantier: d.ville_chantier,
          date_emission:  new Date().toISOString().split("T")[0],
          date_echeance:  new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        },
        (d.lignes || []).map(({ id, created_at, ...l }) => l),
      );
      const full = { ...saved, lignes: d.lignes || [] };
      setInvoices(prev => [full, ...prev]);
      goInvoice(saved.id);
    } catch (err) {
      console.error("[create invoice from devis]", err);
      showErr(err.message?.includes("does not exist") ? "Migration 0005 non appliquée côté Supabase" : "Impossible de créer la facture");
    }
  };

  const onCreateEmptyInvoice = async () => {
    try {
      const numero = await nextInvoiceNumber().catch(() => `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`);
      const saved = await apiCreateInvoice(
        {
          numero,
          objet: "Nouvelle facture",
          operation_type: "service",
          statut: "brouillon",
          montant_ht: 0, montant_tva: 0, montant_ttc: 0,
          date_emission: new Date().toISOString().split("T")[0],
          date_echeance: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        },
        [],
      );
      setInvoices(prev => [{ ...saved, lignes: [] }, ...prev]);
      goInvoice(saved.id);
    } catch (err) {
      console.error("[create empty invoice]", err);
      showErr(err.message?.includes("does not exist") ? "Migration 0005 non appliquée côté Supabase" : "Impossible de créer la facture");
    }
  };

  const onCreateAvoir = async (invoiceId) => {
    if (!user) { showErr("Vous devez être connecté."); return; }
    try {
      const newId = await apiCreateAvoir(invoiceId);
      // Recharge la liste pour récupérer l'avoir fraîchement créé côté DB
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(newId);
    } catch (e) {
      console.error("[create avoir]", e);
      showErr(e?.message || "Impossible de créer l'avoir");
    }
  };

  const onDeleteInvoice = async (id) => {
    if (!user) {
      setInvoices(prev => prev.filter(x => x.id !== id));
      setTab("factures");
      return;
    }
    try {
      await apiDeleteInvoice(id);
      setInvoices(prev => prev.filter(x => x.id !== id));
      setTab("factures");
    } catch (e) {
      console.error("[delete invoice]", e);
      showErr(e?.message || "Impossible de supprimer la facture");
    }
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
    ca:       devis.filter(d => d.statut === "accepte").reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
    enCours:  devis.filter(d => ["envoye", "en_signature"].includes(d.statut)).length,
  };

  const activeNav = NAV.find(n => tab.startsWith(n.id))?.id || "dashboard";

  // ── Écrans hors dashboard ─────────────────────────────────
  if (screen === "auth") return <AuthScreen onEnter={(co, isSignup) => {
    setBrand(b => ({ ...b, companyName: co || "" }));
    setShowPwa(!!isSignup);
    // Nouveau parcours : signup → mini-étape "métiers" → (pwa) → app.
    // Login existant (isSignup=false) → directement app.
    setScreen(isSignup ? "trades_picker" : "app");
  }}/>;
  if (screen === "trades_picker") return <TradesQuickPicker
    brand={brand}
    setBrand={setBrand}
    onDone={() => setScreen(showPwa ? "pwa_install" : "app")}
    onSkip={() => {
      // Marque l'étape comme "vue" côté DB pour éviter de la re-déclencher
      // au prochain login si l'utilisateur a juste voulu passer.
      setBrand(b => ({ ...b, initialSetupDoneAt: new Date().toISOString() }));
      setScreen(showPwa ? "pwa_install" : "app");
    }}
  />;
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
        @media (min-width:1024px){
          .app-sidebar{display:flex !important}
          .app-bottom-nav{display:none !important}
          .app-content{padding-bottom:0 !important}
          .app-toast{bottom:24px !important;left:auto !important;right:24px !important;max-width:380px}
        }
        @media (max-width:1023px){.app-sidebar{display:none !important}}
        .app-sidebar button:hover{background:rgba(255,255,255,.05) !important;color:#94a3b8 !important}
        .app-sidebar button.active-nav:hover{background:rgba(34,197,94,.15) !important;color:#22c55e !important}
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

      {/* Body : sidebar (desktop) + contenu */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar desktop */}
        <nav className="app-sidebar" style={{ display: "none", width: 220, flexDirection: "column", background: "#0f172a", borderRight: "1px solid rgba(255,255,255,.06)", flexShrink: 0, paddingTop: 8, overflowY: "auto" }}>
          {NAV.map(({ id, label, icon }) => {
            const active = activeNav === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={active ? "active-nav" : ""}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: active ? "rgba(34,197,94,.1)" : "transparent", border: "none", borderLeft: `3px solid ${active ? "#22c55e" : "transparent"}`, color: active ? "#22c55e" : "#64748b", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14, fontWeight: active ? 600 : 400, transition: "all .15s", position: "relative" }}>
                {icon}
                <span>{label}</span>
                {id === "agent" && plan === "free" && daysLeft <= 7 && (
                  <span style={{ marginLeft: "auto", background: daysLeft === 0 ? "#ef4444" : "#f97316", color: "white", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>
                    {daysLeft === 0 ? "!" : `${daysLeft}j`}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Contenu principal */}
        <div className="app-content" style={{ flex: 1, overflowY: "auto", paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
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
            onConvertToInvoice={() => onCreateInvoiceFromDevis(selD)}
            autoOpenPDF={autoOpenPDF === selD}
            onAutoOpenPDFConsumed={() => setAutoOpenPDF(null)}
            loading={loadingDevis.has(selD)}/>
        )}
        {tab === "factures"         && <InvoicesList invoices={invoices} clients={clients} goInvoice={goInvoice} onCreateEmpty={onCreateEmptyInvoice}/>}
        {tab === "factures_detail"   && selI && (() => {
          const inv = invoices.find(x => x.id === selI);
          if (!inv) return null;
          return (
            <InvoiceDetail
              invoice={inv}
              client={clients.find(c => c.id === inv.client_id)}
              brand={brand}
              invoices={invoices}
              onBack={() => setTab("factures")}
              onChange={onSaveInvoice}
              onCreateAvoir={onCreateAvoir}
              onDelete={() => { if (confirm("Supprimer cette facture ?")) onDeleteInvoice(inv.id); }}/>
          );
        })()}
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
            onOpenDevisPDF={(id) => { setAutoOpenPDF(id); setSelD(id); setTab("devis_detail"); }}
            brand={brand}/>
        )}
        {tab === "admin"         && isAdmin && <AdminPanel onBack={() => setTab("dashboard")}/>}
        </div>{/* end app-content */}
      </div>{/* end body */}

      {/* Toast */}
      {toast && (
        <div className="app-toast" style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: 12, right: 12, background: toast.isError ? "#7f1d1d" : "#0f172a", color: "white", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,.25)", zIndex: 100, animation: "fadeUp .18s ease both" }}>
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

      {/* Navigation bas (mobile) */}
      <nav className="app-bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, paddingBottom: "env(safe-area-inset-bottom)", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", zIndex: 50 }}>
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

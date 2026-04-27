import { useState, useRef, useEffect } from "react";
import { useAuth } from "./lib/auth.jsx";
import { TRIAL_DAYS } from "./lib/appShell.js";

import { useSaveState } from "./hooks/useSaveState.js";
import { useToast }     from "./hooks/useToast.js";
import { useBrand }     from "./hooks/useBrand.js";
import { useClients }   from "./hooks/useClients.js";
import { useDevis }     from "./hooks/useDevis.js";
import { useInvoices }  from "./hooks/useInvoices.js";

import Logo          from "./components/ui/Logo.jsx";
import { I }         from "./components/ui/icons.jsx";
import Toast         from "./components/app/Toast.jsx";
import BottomNav     from "./components/app/BottomNav.jsx";
import SearchBar     from "./components/app/SearchBar.jsx";
import SaveIndicator from "./components/app/SaveIndicator.jsx";
import Dashboard     from "./components/Dashboard.jsx";
import ClientsList   from "./components/ClientsList.jsx";
import ClientDetail  from "./components/ClientDetail.jsx";
import DevisList     from "./components/DevisList.jsx";
import DevisDetail   from "./components/DevisDetail.jsx";
import InvoicesList  from "./components/InvoicesList.jsx";
import InvoiceDetail from "./components/InvoiceDetail.jsx";
import AgentIA       from "./components/AgentIA.jsx";
import AdminPanel    from "./components/AdminPanel.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Onboarding        from "./pages/Onboarding.jsx";
import TradesQuickPicker from "./pages/TradesQuickPicker.jsx";
import AuthScreen        from "./pages/AuthScreen.jsx";
import PaywallScreen     from "./pages/PaywallScreen.jsx";
import PWAInstallScreen  from "./pages/PWAInstallScreen.jsx";

const NAV = [
  { id: "dashboard", label: "Accueil",  icon: I.trend },
  { id: "clients",   label: "Clients",  icon: I.users },
  { id: "devis",     label: "Devis",    icon: I.file  },
  { id: "factures",  label: "Factures", icon: I.file  },
  { id: "agent",     label: "Agent IA", icon: I.spark },
];

export default function App() {
  const [screen, setScreen] = useState("app");
  const [tab,    setTab]    = useState("dashboard");
  const [selC,   setSelC]   = useState(null);
  const [plan,      setPlan]      = useState("free");   // "free" | "pro"
  const [billingType, setBillingType] = useState(null); // "monthly" | "biannual" — défini à l'abonnement
  const [showPwa,setShowPwa]= useState(false);
  const deferredPrompt = useRef(null);

  const { user, signOut } = useAuth();
  const { saveState, setSaveState, markSaving, markSaved } = useSaveState();
  const { toast, showUndo, showErr, dismissToast } = useToast();
  const saveCallbacks = { markSaving, markSaved, setSaveState, showErr };

  const { brand, setBrand }                             = useBrand(user, setScreen);
  const { clients, setClients, onSaveClient, onDeleteClient, onRestoreClient } = useClients(user, saveCallbacks);
  const {
    devis, setDevis, selD, setSelD, loadingDevis, autoOpenPDF, setAutoOpenPDF,
    onSaveDevis, onCreateDevis, onDuplicateDevis, onCreateIndice, onDeleteDevis, goDevis,
  } = useDevis(user, { ...saveCallbacks, setTab });
  const {
    invoices, selI, onSaveInvoice, onCreateInvoiceFromDevis, onCreateEmptyInvoice,
    onCreateAcompte, onCreateAvoir, onDeleteInvoice, goInvoice,
  } = useInvoices(user, devis, brand, { ...saveCallbacks, setTab });

  const isAdmin = !!user?.email && !!import.meta.env.VITE_ADMIN_EMAIL &&
    user.email.trim().toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL.trim().toLowerCase();

  // Capture beforeinstallprompt for Android PWA
  useEffect(() => {
    const handler = e => { e.preventDefault(); deferredPrompt.current = e; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleSignOut = () => {
    if (!window.confirm("Se déconnecter ?")) return;
    setClients([]); setDevis([]); setSelD(null); setSelC(null); setTab("dashboard");
    signOut();
  };

  const trialStart   = user?.created_at ? new Date(user.created_at).getTime() : null;
  const daysLeft     = trialStart !== null ? Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - trialStart) / 86400000)) : TRIAL_DAYS;
  const trialExpired = plan === "free" && daysLeft === 0;

  const stats = {
    clients:  clients.length,
    acceptes: devis.filter(d => d.statut === "accepte").length,
    ca:       devis.filter(d => d.statut === "accepte").reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
    enCours:  devis.filter(d => ["envoye", "en_signature"].includes(d.statut)).length,
  };

  const activeNav = NAV.find(n => tab.startsWith(n.id))?.id || "dashboard";

  // ── Écrans hors dashboard ──────────────────────────────────
  if (screen === "auth") return <AuthScreen onEnter={(co, isSignup) => {
    setBrand(b => ({ ...b, companyName: co || "" }));
    setShowPwa(!!isSignup);
    setScreen(isSignup ? "trades_picker" : "app");
  }}/>;
  if (screen === "trades_picker") return <TradesQuickPicker
    brand={brand}
    setBrand={setBrand}
    onDone={() => { setTab("agent"); setScreen(showPwa ? "pwa_install" : "app"); }}
    onSkip={() => {
      setBrand(b => ({ ...b, initialSetupDoneAt: new Date().toISOString() }));
      setTab("agent");
      setScreen(showPwa ? "pwa_install" : "app");
    }}
  />;
  if (screen === "onboarding")  return <Onboarding brand={brand} setBrand={setBrand} onDone={() => setScreen(showPwa ? "pwa_install" : "app")}/>;
  if (screen === "pwa_install") return <PWAInstallScreen deferredPrompt={deferredPrompt.current} onDone={() => { setShowPwa(false); setScreen("app"); }}/>;
  if (screen === "paywall")     return <PaywallScreen daysLeft={daysLeft} onBack={() => setScreen("app")} onSubscribe={(type) => { setPlan("pro"); setBillingType(type); setScreen("app"); }}/>;

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", height: "100dvh", display: "flex", flexDirection: "column", background: "#FAF7F2", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,400;1,700&family=Space+Grotesk:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#1A1612}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#E8E2D8;border-radius:2px}
        @keyframes fadeUp{from{opacity:0}to{opacity:1}}
        @keyframes popIn{0%{opacity:0;transform:scale(.92) translateY(6px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .fu{animation:fadeUp .22s ease both}
        .pop{animation:popIn .28s cubic-bezier(.34,1.56,.64,1) both}
        input,textarea,select,button{font-family:inherit}
        input,textarea,select{font-size:max(16px,1em) !important}
        @media (display-mode: standalone){
          .app-bottom-nav{padding-bottom:env(safe-area-inset-bottom)}
          .app-content{padding-bottom:calc(64px + env(safe-area-inset-bottom)) !important}
        }
        @media (min-width:1024px){
          .app-sidebar{display:flex !important}
          .app-bottom-nav{display:none !important}
          .app-content{padding-bottom:0 !important}
          .app-toast{bottom:24px !important;left:auto !important;right:24px !important;max-width:380px}
        }
        @media (max-width:1023px){.app-sidebar{display:none !important}}
        .app-sidebar button:hover{background:rgba(255,255,255,.05) !important;color:#9A8E82 !important}
        .app-sidebar button.active-nav:hover{background:rgba(34,197,94,.15) !important;color:#22c55e !important}
      `}</style>

      {/* Header */}
      <header style={{ background: "#1A1612", padding: "calc(10px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 10px calc(18px + env(safe-area-inset-left))", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <Logo size={24} white/>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setTab("admin")} title="Panel Admin"
              style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, color: "#f59e0b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ⚙ Admin
            </button>
          )}
          <button onClick={() => setScreen("onboarding")}
            style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, color: "#9A8E82", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
            {I.paint} Mon profil
          </button>
          {user && (
            <button onClick={handleSignOut} title="Se déconnecter"
              style={{ background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8, padding: "5px 8px", display: "flex", alignItems: "center", color: "#ef4444", cursor: "pointer" }}>
              {I.logout}
            </button>
          )}
          <SaveIndicator state={saveState}/>
          {plan === "pro"
            ? <span style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid rgba(34,197,94,.25)" }}>PRO</span>
            : <span style={{ background: daysLeft <= 7 ? "rgba(249,115,22,.15)" : "#2A231C", color: daysLeft <= 7 ? "#fb923c" : "#9A8E82", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, border: daysLeft <= 7 ? "1px solid rgba(249,115,22,.25)" : "none" }}>Essai · {daysLeft}j</span>
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

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar desktop */}
        <nav className="app-sidebar" style={{ display: "none", width: 220, flexDirection: "column", background: "#1A1612", borderRight: "1px solid rgba(255,255,255,.06)", flexShrink: 0, paddingTop: 8, overflowY: "auto" }}>
          {NAV.map(({ id, label, icon }) => {
            const active = activeNav === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={active ? "active-nav" : ""}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: active ? "rgba(34,197,94,.1)" : "transparent", border: "none", borderLeft: `3px solid ${active ? "#22c55e" : "transparent"}`, color: active ? "#22c55e" : "#6B6358", cursor: "pointer", width: "100%", textAlign: "left", fontSize: 14, fontWeight: active ? 600 : 400, transition: "all .15s", position: "relative" }}>
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
        <div className="app-content" style={{ flex: 1, overflowY: "auto", paddingBottom: "64px" }}>
          {["devis", "devis_detail", "factures", "factures_detail"].includes(tab) && (
            <SearchBar devis={devis} clients={clients} invoices={invoices} goDevis={goDevis} goClient={id => { setSelC(id); setTab("client_detail"); }} goInvoice={goInvoice}/>
          )}
          {tab === "dashboard"     && <Dashboard stats={stats} devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} brand={brand}
                                         onOpenProfile={() => setScreen("onboarding")}
                                         onOpenPWAInstall={() => setScreen("pwa_install")}/>}
          {tab === "clients"       && <ClientsList clients={clients} onSave={onSaveClient} onDelete={onDeleteClient} onRestore={onRestoreClient} goClient={id => { setSelC(id); setTab("client_detail"); }} showUndo={showUndo}/>}
          {tab === "client_detail" && selC && (
            <ClientDetail
              c={clients.find(x => x.id === selC)}
              clientDevis={devis.filter(d => d.client_id === selC)}
              onBack={() => setTab("clients")}
              goDevis={goDevis}
              onUpdate={onSaveClient}
              onDelete={async () => { await onDeleteClient(selC); setTab("clients"); }}/>
          )}
          {tab === "devis"        && <DevisList devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} onDelete={onDeleteDevis}/>}
          {tab === "devis_detail" && selD && (
            <DevisDetail
              d={devis.find(x => x.id === selD)}
              cl={clients.find(c => c.id === devis.find(x => x.id === selD)?.client_id)}
              clients={clients}
              onBack={() => setTab("devis")}
              brand={brand}
              onChange={onSaveDevis}
              onConvertToInvoice={() => onCreateInvoiceFromDevis(selD)}
              onCreateAcompte={onCreateAcompte}
              onDuplicate={() => onDuplicateDevis(selD)}
              onCreateIndice={() => onCreateIndice(selD)}
              groupVersions={(() => {
                const cur    = devis.find(x => x.id === selD);
                if (!cur) return [];
                const rootId = cur.root_devis_id || cur.id;
                return devis
                  .filter(x => x.id === rootId || x.root_devis_id === rootId)
                  .sort((a, b) => !a.indice ? -1 : !b.indice ? 1 : a.indice.localeCompare(b.indice));
              })()}
              goDevis={goDevis}
              autoOpenPDF={autoOpenPDF === selD}
              onAutoOpenPDFConsumed={() => setAutoOpenPDF(null)}
              loading={loadingDevis.has(selD)}/>
          )}
          {tab === "factures"        && <InvoicesList invoices={invoices} clients={clients} goInvoice={goInvoice} onCreateEmpty={onCreateEmptyInvoice} onDelete={onDeleteInvoice}/>}
          {tab === "factures_detail" && selI && (() => {
            const inv = invoices.find(x => x.id === selI);
            if (!inv) return null;
            const linkedDevis = inv.devis_id ? devis.find(d => d.id === inv.devis_id) : null;
            return (
              <InvoiceDetail
                invoice={linkedDevis ? { ...inv, devis_numero: linkedDevis.numero } : inv}
                client={clients.find(c => c.id === inv.client_id)}
                clients={clients}
                brand={brand}
                invoices={invoices}
                onBack={() => setTab("factures")}
                onChange={onSaveInvoice}
                onCreateAvoir={onCreateAvoir}
                onDelete={() => { if (confirm("Supprimer cette facture ?")) onDeleteInvoice(inv.id); }}/>
            );
          })()}
          {tab === "agent" && (
            <AgentIA
              devis={devis}
              onCreateDevis={onCreateDevis}
              clients={clients}
              onSaveClient={onSaveClient}
              plan={plan}
              trialExpired={trialExpired}
              onPaywall={() => setScreen("paywall")}
              setTab={setTab}
              onOpenDevisPDF={(id) => { setAutoOpenPDF(id); goDevis(id); }}
              brand={brand}/>
          )}
          {tab === "admin" && isAdmin && (
            <ErrorBoundary>
              <AdminPanel onBack={() => setTab("dashboard")}/>
            </ErrorBoundary>
          )}
        </div>
      </div>

      <Toast toast={toast} onDismiss={dismissToast}/>
      <BottomNav items={NAV} activeNav={activeNav} onSelect={setTab} plan={plan} daysLeft={daysLeft}/>
    </div>
  );
}

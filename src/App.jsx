import { useState, useRef, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { useAuth } from "./lib/auth.jsx";
import { supabase } from "./lib/supabase.js";
import { getMyProfile, getDevisWeekCount } from "./lib/api.js";
import { FREEMIUM_WEEKLY_DEVIS_LIMIT, countDevisThisWeek, readStickyDevisThisWeek, bumpStickyDevisThisWeek } from "./lib/appShell.js";

import { useSaveState } from "./hooks/useSaveState.js";
import { useToast }     from "./hooks/useToast.js";
import { useBrand }     from "./hooks/useBrand.js";
import { useClients }   from "./hooks/useClients.js";
import { useDevis }     from "./hooks/useDevis.js";
import { useInvoices }  from "./hooks/useInvoices.js";

import Logo          from "./components/ui/Logo.jsx";
import { I }         from "./components/ui/icons.jsx";
import Toast         from "./components/app/Toast.jsx";
import UpdateAvailableToast from "./components/app/UpdateAvailableToast.jsx";
import NavFAB        from "./components/app/NavFAB.jsx";
import SearchBar     from "./components/app/SearchBar.jsx";
import SaveIndicator from "./components/app/SaveIndicator.jsx";
import HeaderMenu    from "./components/app/HeaderMenu.jsx";
import Dashboard     from "./components/Dashboard.jsx";
import ClientsList   from "./components/ClientsList.jsx";
import ClientDetail  from "./components/ClientDetail.jsx";
import DevisList     from "./components/DevisList.jsx";
import InvoicesList  from "./components/InvoicesList.jsx";
import SupportChat   from "./components/SupportChat.jsx";
import SendToComptableModal from "./components/app/SendToComptableModal.jsx";
import AuthScreen    from "./pages/AuthScreen.jsx";

// Écrans lourds — chargés à la demande uniquement
const DevisDetail        = lazy(() => import("./components/DevisDetail.jsx"))
const InvoiceDetail      = lazy(() => import("./components/InvoiceDetail.jsx"))
const AgentIA            = lazy(() => import("./components/AgentIA.jsx"))
const AdminPanel         = lazy(() => import("./components/AdminPanel.jsx"))
const Onboarding         = lazy(() => import("./pages/Onboarding.jsx"))
const TradesQuickPicker  = lazy(() => import("./pages/TradesQuickPicker.jsx"))
const PaywallScreen      = lazy(() => import("./pages/PaywallScreen.jsx"))
const PWAInstallScreen   = lazy(() => import("./pages/PWAInstallScreen.jsx"))
const SubscriptionScreen = lazy(() => import("./pages/SubscriptionScreen.jsx"))

const ScreenLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200 }}>
    <div style={{ width: 20, height: 20, border: "2px solid #E8E2D8", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
  </div>
)

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
  const [plan,         setPlan]         = useState("free");
  const [billingCycle, setBillingCycle] = useState(null);
  const [showPwa,setShowPwa]= useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [comptableOpen, setComptableOpen] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(() => {
    try { return ['monthly','biannual'].includes(localStorage.getItem('pending_checkout_plan')) }
    catch { return false }
  });
  const [checkoutError, setCheckoutError] = useState(null);
  const deferredPrompt = useRef(null);

  const { user, signOut } = useAuth();
  const { saveState, setSaveState, markSaving, markSaved } = useSaveState();
  const { toast, showUndo, showErr, dismissToast } = useToast();
  const saveCallbacks = { markSaving, markSaved, setSaveState, showErr };

  const [serverIsAdmin, setServerIsAdmin] = useState(false);
  const isAdminViaEnv = !!user?.email && !!import.meta.env.VITE_ADMIN_EMAIL &&
    user.email.trim().toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL.trim().toLowerCase();
  // Détection admin : env var côté front (rapide) OR check server-side basé
  // sur ADMIN_EMAIL (robuste — couvre le cas où VITE_ADMIN_EMAIL n'est pas
  // configuré dans Vercel).
  const isAdmin = isAdminViaEnv || serverIsAdmin;

  const effectivePlan = isAdmin ? "pro" : plan;
  const isFreemium    = !isAdmin && effectivePlan === "free";

  // Compteur sticky : nombre de devis créés cette semaine ISO par
  // l'utilisateur sur cet appareil. Ne décrémente pas à la suppression
  // (anti-bypass). Source de vérité côté DB (RPC devis_week_count).
  // La clé localStorage est scopée par user.id pour qu'un nouvel inscrit
  // n'hérite pas du compteur d'un autre compte sur le même navigateur.
  const [stickyDevisThisWeek, setStickyDevisThisWeek] = useState(() => readStickyDevisThisWeek(user?.id));
  const [weekCount,           setWeekCount]           = useState(0);

  useEffect(() => {
    // Re-synchronise le compteur sticky local au changement de semaine
    // (cas du dimanche → lundi pendant qu'une session est ouverte) ET au
    // changement d'utilisateur (pour basculer sur la clé scopée du nouvel
    // user et éviter d'afficher un compteur hérité d'un autre compte).
    //
    // On tick au mount, à chaque retour de focus (visibilitychange), et
    // toutes les 5 min en filet de sécurité — vs un setInterval(60s) qui
    // consommait du CPU/batterie pour rien quand l'app était en background.
    const tick = () => setStickyDevisThisWeek(readStickyDevisThisWeek(user?.id));
    tick();
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(tick, 5 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setWeekCount(0); return; }
    let cancelled = false;
    getDevisWeekCount()
      .then(n => { if (!cancelled) setWeekCount(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const onDevisCreated = () => {
    setStickyDevisThisWeek(bumpStickyDevisThisWeek(user?.id));
    setWeekCount(c => c + 1);
  };
  const onQuotaReached = () => setScreen("paywall");

  const { brand, setBrand }                             = useBrand(user, setScreen);
  const { clients, setClients, onSaveClient, onDeleteClient, onRestoreClient } = useClients(user, saveCallbacks);
  const {
    devis, setDevis, selD, setSelD, loadingDevis, autoOpenPDF, setAutoOpenPDF,
    onSaveDevis, onCreateDevis, onDuplicateDevis, onCreateIndice, onDeleteDevis, goDevis,
  } = useDevis(user, { ...saveCallbacks, setTab, effectivePlan, weekCount, stickyDevisThisWeek, onDevisCreated, onQuotaReached, isAdmin });
  const {
    invoices, selI, onSaveInvoice, onCreateInvoiceFromDevis, onCreateEmptyInvoice,
    onCreateAcompte, onCreateAvoir, onDeleteInvoice, goInvoice,
  } = useInvoices(user, devis, brand, { ...saveCallbacks, setTab });

  useEffect(() => {
    const handler = e => { e.preventDefault(); deferredPrompt.current = e; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyProfile()
      .then(p => {
        if (cancelled) return;
        if (p?.plan === "pro" || p?.plan === "free") setPlan(p.plan);
        if (p?.billing_cycle === "monthly" || p?.billing_cycle === "biannual") setBillingCycle(p.billing_cycle);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Vérifie côté serveur si l'utilisateur est l'admin (matching sur ADMIN_EMAIL).
  // Robuste : fonctionne même si VITE_ADMIN_EMAIL n'est pas configuré dans Vercel.
  useEffect(() => {
    if (!user) { setServerIsAdmin(false); return; }
    if (isAdminViaEnv) { setServerIsAdmin(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch('/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'whoami' }),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.is_admin) setServerIsAdmin(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.id, isAdminViaEnv]);

  useEffect(() => {
    if (!user || !checkoutPending) return;
    let pendingPlan;
    try { pendingPlan = localStorage.getItem('pending_checkout_plan') } catch {}
    if (pendingPlan !== 'monthly' && pendingPlan !== 'biannual') {
      setCheckoutPending(false);
      return;
    }
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Vous devez être connecté.");
        const res  = await fetch('/api/stripe-checkout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ plan: pendingPlan }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.url) throw new Error(data?.error || `Erreur ${res.status}`);
        try { localStorage.removeItem('pending_checkout_plan') } catch {}
        window.location.href = data.url;
      } catch (e) {
        setCheckoutError(e?.message || 'Redirection vers le paiement impossible');
      }
    })();
  }, [user, checkoutPending]);

  const handleSignOut = () => {
    if (!window.confirm("Se déconnecter ?")) return;
    setClients([]); setDevis([]); setSelD(null); setSelC(null); setTab("dashboard");
    signOut();
  };

  // Compteur affiché : MAX entre la RPC DB, le sticky localStorage et le state.
  // - DB : source de vérité, résiste à la suppression
  // - sticky : couvre la création optimiste avant retour serveur
  // - state : couvre le cas d'un nouvel appareil avant chargement de la RPC
  const devisThisWeekCount  = isFreemium ? Math.max(weekCount, stickyDevisThisWeek, countDevisThisWeek(devis)) : 0;
  const freemiumQuotaReached = isFreemium && devisThisWeekCount >= FREEMIUM_WEEKLY_DEVIS_LIMIT;

  const stats = {
    clients:  clients.length,
    acceptes: devis.filter(d => d.statut === "accepte").length,
    ca:       devis.filter(d => d.statut === "accepte").reduce((s, d) => s + (Number(d.montant_ht) || 0), 0),
    enCours:  devis.filter(d => ["envoye", "en_signature"].includes(d.statut)).length,
  };

  const activeNav = NAV.find(n => tab.startsWith(n.id))?.id || "dashboard";

  // Préserve la position de scroll de chaque tab : quand on revient sur
  // un tab visité, on retombe là où on s'était arrêté plutôt que tout
  // en haut. Indispensable sur DevisList / FacturesList qui peuvent
  // contenir 50+ entrées.
  const contentRef = useRef(null);
  const scrollMapRef = useRef({});
  const skipNextScrollRef = useRef(false);

  // Hauteur du shell pilotée par JS via window.innerHeight / visualViewport.
  // Sur iOS PWA standalone, ni 100vh, ni 100dvh, ni height:100% sur html/body
  // ne donnent fiablement la hauteur du visual viewport — on observe une
  // grosse bande noire sous la nav qui ne disparaît pas. La seule mesure
  // stable est window.innerHeight (ou visualViewport.height quand dispo).
  // On l'applique directement sur documentElement + body (et pas via un
  // ref React, qui se ferait écraser par le re-render).
  useLayoutEffect(() => {
    const setH = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.height = h + "px";
      document.body.style.height = h + "px";
    };
    setH();
    window.visualViewport?.addEventListener("resize", setH);
    window.addEventListener("resize", setH);
    window.addEventListener("orientationchange", setH);
    return () => {
      window.visualViewport?.removeEventListener("resize", setH);
      window.removeEventListener("resize", setH);
      window.removeEventListener("orientationchange", setH);
    };
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      // Ignore le scroll programmatique déclenché par la restauration.
      if (skipNextScrollRef.current) { skipNextScrollRef.current = false; return; }
      scrollMapRef.current[tab] = el.scrollTop;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [tab]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    skipNextScrollRef.current = true;
    el.scrollTop = scrollMapRef.current[tab] || 0;
    // Filet : si la valeur cible est la même que l'actuelle, aucun
    // scroll event n'est émis et le flag resterait coincé à true.
    requestAnimationFrame(() => { skipNextScrollRef.current = false; });
  }, [tab]);

  if (checkoutPending) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FAF7F2", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.5px" }}>
            <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "#1A1612" }}>bat</span>
          </div>
          {!checkoutError ? (
            <>
              <div style={{ fontSize: 16, color: "#1A1612", fontWeight: 600, marginBottom: 8 }}>Redirection vers le paiement…</div>
              <div style={{ fontSize: 13, color: "#6B6358", lineHeight: 1.6 }}>Vous allez être redirigé vers Stripe pour finaliser votre abonnement.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, color: "#991b1b", fontWeight: 600, marginBottom: 8 }}>Le paiement n'a pas pu démarrer</div>
              <div style={{ fontSize: 13, color: "#6B6358", lineHeight: 1.6, marginBottom: 16 }}>{checkoutError}</div>
              <button
                onClick={() => { setCheckoutError(null); setCheckoutPending(false); try { localStorage.removeItem('pending_checkout_plan') } catch {} }}
                style={{ background: "#1A1612", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Continuer en freemium
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Écrans hors dashboard ──────────────────────────────────
  if (screen === "auth") return <AuthScreen onEnter={(co, isSignup) => {
    setBrand(b => ({ ...b, companyName: co || "" }));
    setShowPwa(!!isSignup);
    setScreen(isSignup ? "trades_picker" : "app");
  }}/>;
  if (screen === "trades_picker") return (
    <Suspense fallback={<ScreenLoader />}>
      <TradesQuickPicker
        brand={brand}
        setBrand={setBrand}
        onDone={() => { setTab("agent"); setScreen(showPwa ? "pwa_install" : "app"); }}
        onSkip={() => {
          setBrand(b => ({ ...b, initialSetupDoneAt: new Date().toISOString() }));
          setTab("agent");
          setScreen(showPwa ? "pwa_install" : "app");
        }}
      />
    </Suspense>
  );
  if (screen === "onboarding") return (
    <Suspense fallback={<ScreenLoader />}>
      <Onboarding brand={brand} setBrand={setBrand} onDone={() => setScreen(showPwa ? "pwa_install" : "app")}/>
    </Suspense>
  );
  if (screen === "pwa_install") return (
    <Suspense fallback={<ScreenLoader />}>
      <PWAInstallScreen deferredPrompt={deferredPrompt.current} onDone={() => { setShowPwa(false); setScreen("app"); }}/>
    </Suspense>
  );
  if (screen === "paywall") return (
    <Suspense fallback={<ScreenLoader />}>
      <PaywallScreen
        quotaReached={freemiumQuotaReached}
        weekCount={devisThisWeekCount}
        weekLimit={FREEMIUM_WEEKLY_DEVIS_LIMIT}
        onBack={() => setScreen("app")}
        onSubscribe={(type) => { setPlan("pro"); setBillingCycle(type); setScreen("app"); }}/>
    </Suspense>
  );
  if (screen === "subscription") return (
    <Suspense fallback={<ScreenLoader />}>
      <SubscriptionScreen isAdmin={isAdmin} plan={effectivePlan} billingCycle={billingCycle} onBack={() => setScreen("app")}/>
    </Suspense>
  );

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", height: "100%", display: "flex", flexDirection: "column", background: "#FAF7F2", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,400;1,700&family=Space+Grotesk:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;overflow:hidden}
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
        @media (min-width:1024px){
          .app-sidebar{display:flex !important}
          .app-bottom-nav{display:none !important}
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
          <SaveIndicator state={saveState}/>
          <HeaderMenu
            isAdmin={isAdmin}
            user={user}
            effectivePlan={effectivePlan}
            billingCycle={billingCycle}
            weekCount={devisThisWeekCount}
            weekLimit={FREEMIUM_WEEKLY_DEVIS_LIMIT}
            onOpenAdmin={() => setTab("admin")}
            onOpenProfile={() => setScreen("onboarding")}
            onOpenSubscription={() => setScreen("subscription")}
            onOpenPaywall={() => setScreen("paywall")}
            onOpenSupport={tab !== "agent" && tab !== "admin" ? () => setSupportOpen(true) : null}
            onOpenComptable={() => setComptableOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      {/* Compteur quota devis freemium (hebdomadaire) */}
      {isFreemium && devisThisWeekCount > 0 && (
        <button onClick={() => setScreen("paywall")}
          style={{ flexShrink: 0, width: "100%", background: freemiumQuotaReached ? "#fef2f2" : "#f0fdf4", borderBottom: `1px solid ${freemiumQuotaReached ? "#fecaca" : "#bbf7d0"}`, padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", border: "none", color: freemiumQuotaReached ? "#991b1b" : "#166534", fontSize: 11, fontWeight: 600 }}>
          {freemiumQuotaReached
            ? `⛔ Limite atteinte (${FREEMIUM_WEEKLY_DEVIS_LIMIT}/${FREEMIUM_WEEKLY_DEVIS_LIMIT} devis cette semaine) — passer en Pro`
            : `📝 ${devisThisWeekCount}/${FREEMIUM_WEEKLY_DEVIS_LIMIT} devis cette semaine — passer en Pro`}
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
                {id === "agent" && isFreemium && freemiumQuotaReached && (
                  <span style={{ marginLeft: "auto", background: "#ef4444", color: "white", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>
                    !
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Contenu principal */}
        <div ref={contentRef} className="app-content" style={{ flex: 1, overflowY: "auto" }}>
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
          {tab === "devis"         && <DevisList devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} onDelete={onDeleteDevis}/>}
          {tab === "devis_detail"  && selD && (() => {
            const cur = devis.find(x => x.id === selD);
            // Devis introuvable dans le state (ex. création bloquée par le quota freemium)
            if (!cur) {
              if (loadingDevis.has(selD)) return <ScreenLoader />;
              return (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#6B6358", marginBottom: 12 }}>Ce devis est introuvable.</div>
                  <button onClick={() => { setSelD(null); setTab("devis"); }}
                    style={{ background: "#1A1612", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Retour à la liste
                  </button>
                </div>
              );
            }
            const rootId = cur.root_devis_id || cur.id;
            const groupVersions = devis
              .filter(x => x.id === rootId || x.root_devis_id === rootId)
              .sort((a, b) => !a.indice ? -1 : !b.indice ? 1 : a.indice.localeCompare(b.indice));
            return (
              <Suspense fallback={<ScreenLoader />}>
                <DevisDetail
                  d={cur}
                  cl={clients.find(c => c.id === cur.client_id)}
                  clients={clients}
                  onBack={() => setTab("devis")}
                  brand={brand}
                  onChange={onSaveDevis}
                  onConvertToInvoice={() => onCreateInvoiceFromDevis(selD)}
                  onCreateAcompte={onCreateAcompte}
                  onDuplicate={() => onDuplicateDevis(selD)}
                  onCreateIndice={() => onCreateIndice(selD)}
                  groupVersions={groupVersions}
                  goDevis={goDevis}
                  isFreemium={isFreemium}
                  onPaywall={() => setScreen("paywall")}
                  autoOpenPDF={autoOpenPDF === selD}
                  onAutoOpenPDFConsumed={() => setAutoOpenPDF(null)}
                  loading={loadingDevis.has(selD)}/>
              </Suspense>
            );
          })()}
          {tab === "factures"        && <InvoicesList invoices={invoices} clients={clients} goInvoice={goInvoice} onCreateEmpty={onCreateEmptyInvoice} onDelete={onDeleteInvoice} isFreemium={isFreemium} onPaywall={() => setScreen("paywall")}/>}
          {tab === "factures_detail" && selI && (() => {
            const inv = invoices.find(x => x.id === selI);
            if (!inv) return null;
            const linkedDevis = inv.devis_id ? devis.find(d => d.id === inv.devis_id) : null;
            return (
              <Suspense fallback={<ScreenLoader />}>
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
              </Suspense>
            );
          })()}
          {tab === "agent" && (
            <Suspense fallback={<ScreenLoader />}>
              <AgentIA
                devis={devis}
                onCreateDevis={onCreateDevis}
                clients={clients}
                onSaveClient={onSaveClient}
                plan={effectivePlan}
                quotaReached={freemiumQuotaReached}
                onPaywall={() => setScreen("paywall")}
                setTab={setTab}
                onOpenDevisPDF={(id) => { setAutoOpenPDF(id); goDevis(id); }}
                brand={brand}/>
            </Suspense>
          )}
          {tab === "admin" && isAdmin && (
            <Suspense fallback={<ScreenLoader />}>
              <AdminPanel onBack={() => setTab("dashboard")}/>
            </Suspense>
          )}
        </div>
      </div>

      <Toast toast={toast} onDismiss={dismissToast}/>
      <UpdateAvailableToast />
      <SupportChat accent={brand?.color || "#22c55e"} open={supportOpen} onClose={() => setSupportOpen(false)}/>
      {comptableOpen && (
        <SendToComptableModal user={user} onClose={() => setComptableOpen(false)}/>
      )}
      <NavFAB items={NAV} activeNav={activeNav} onSelect={setTab} plan={effectivePlan} quotaReached={freemiumQuotaReached} firstDevisNudge={!isAdmin && (devis?.length || 0) === 0 && activeNav !== "agent"}/>
    </div>
  );
}

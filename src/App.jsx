import { useState, useRef, useEffect, useLayoutEffect, useCallback, Suspense } from "react";
import { useAuth } from "./lib/auth.jsx";
import { supabase } from "./lib/supabase.js";
import { getMyProfile, getDevisWeekCount } from "./lib/api.js";
import { FREEMIUM_WEEKLY_DEVIS_LIMIT, countDevisThisWeek, readStickyDevisThisWeek, bumpStickyDevisThisWeek } from "./lib/appShell.js";

import { useSaveState }   from "./hooks/useSaveState.js";
import { useToast }       from "./hooks/useToast.js";
import { useBrand }       from "./hooks/useBrand.js";
import { useKeyboardOpen } from "./hooks/useKeyboardOpen.js";
import { useClients }   from "./hooks/useClients.js";
import { useDevis }     from "./hooks/useDevis.js";
import { useInvoices }  from "./hooks/useInvoices.js";
import { useSupportUnread } from "./hooks/useSupportUnread.js";

import { I }         from "./components/ui/icons.jsx";
import { ZB }        from "./lib/theme.js";
import Toast         from "./components/app/Toast.jsx";
import UpdateAvailableToast from "./components/app/UpdateAvailableToast.jsx";
import BottomNav, { NAV_RESERVED_CSS }    from "./components/app/BottomNav.jsx";
import BottomNavActionSheet from "./components/app/BottomNavActionSheet.jsx";
import ViewportDiag from "./components/app/ViewportDiag.jsx";
import { iosViewportGap, isStandalone } from "./lib/iosViewportGap.js";
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
import EmailVerificationBanner from "./components/app/EmailVerificationBanner.jsx";

// Écrans principaux — imports synchrones (pas de lazy/import dynamique).
// Historique : ces 9 écrans étaient lazy-loadés pour réduire le bundle
// initial, mais ça générait des « Importing a module script failed »
// dès qu'un utilisateur PWA avait l'ancien index.html en cache et que
// le déploiement Vercel avait renommé les chunks. Trade-off accepté :
// bundle initial ~25 % plus gros au boot (≈ 0,3 s sur 4G) contre ZÉRO
// chunk error possible sur les écrans utilisés au quotidien.
import DevisDetail        from "./components/DevisDetail.jsx"
import InvoiceDetail      from "./components/InvoiceDetail.jsx"
import AgentIA            from "./components/AgentIA.jsx"
import AdminPanel         from "./components/AdminPanel.jsx"
import Onboarding         from "./pages/Onboarding.jsx"
import TradesQuickPicker  from "./pages/TradesQuickPicker.jsx"
import PaywallScreen      from "./pages/PaywallScreen.jsx"
import PWAInstallScreen   from "./pages/PWAInstallScreen.jsx"
import SubscriptionScreen from "./pages/SubscriptionScreen.jsx"

const ScreenLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200 }}>
    <div style={{ width: 20, height: 20, border: `2px solid ${ZB.rule}`, borderTopColor: ZB.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
  </div>
)

const NAV = [
  { id: "dashboard", label: "Accueil",  icon: I.home    },
  { id: "clients",   label: "Clients",  icon: I.users   },
  { id: "agent",     label: "Agent IA", icon: I.spark   },
  { id: "devis",     label: "Devis",    icon: I.file    },
  { id: "factures",  label: "Factures", icon: I.receipt },
];

// Titre affiché dans la barre du haut pour chaque écran.
const SCREEN_TITLES = {
  dashboard: "Accueil", clients: "Clients", client_detail: "Client",
  devis: "Devis", devis_detail: "Devis", factures: "Factures", factures_detail: "Facture",
  agent: "Agent IA", admin: "Administration",
};

// Onglet initial depuis ?tab= dans l'URL — utilisé par les liens dans les
// emails artisan (ex. notification de négociation client). On nettoie
// l'URL après lecture pour ne pas la re-jouer à chaque refresh.
function initialTabFromUrl() {
  if (typeof window === "undefined") return "dashboard";
  try {
    const t = new URLSearchParams(window.location.search).get("tab");
    const allowed = ["dashboard", "clients", "agent", "devis", "factures"];
    if (t && allowed.includes(t)) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
      return t;
    }
  } catch { /* ignore */ }
  return "dashboard";
}

// emailVerification : { blocking } quand l'email n'est pas encore confirmé (Root).
export default function App({ emailVerification = null } = {}) {
  const [screen, setScreen] = useState("app");
  const [tab,    setTab]    = useState(initialTabFromUrl);
  // Diagnostic d'affichage : 5 appuis rapides sur le logo de l'en-tête.
  const [diagOpen, setDiagOpen] = useState(false);
  const logoTapsRef = useRef([]);
  const onLogoTap = () => {
    const now = Date.now();
    logoTapsRef.current = [...logoTapsRef.current.filter(t => now - t < 2000), now];
    if (logoTapsRef.current.length >= 5) { logoTapsRef.current = []; setDiagOpen(true); }
  };
  const [selC,   setSelC]   = useState(null);
  const [plan,         setPlan]         = useState("free");
  const [billingCycle, setBillingCycle] = useState(null);
  const [showPwa,setShowPwa]= useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { hasUnread: supportUnread, refresh: refreshSupportUnread } = useSupportUnread();
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
  // Mobile soft keyboard ouvert : on collapse le paddingBottom réservé
  // au BottomNav (qui est aussi caché) pour éliminer le vide visible
  // entre le contenu (ex. textarea AgentIA) et le clavier.
  const keyboardOpen = useKeyboardOpen();
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
  const {
    clients, setClients, onSaveClient, onDeleteClient, onRestoreClient,
    loaded: clientsLoaded, loadError: clientsLoadError, reload: reloadClients,
  } = useClients(user, saveCallbacks);
  const {
    devis, setDevis, selD, setSelD, loadingDevis, autoOpenPDF, setAutoOpenPDF,
    loaded: devisLoaded, loadError: devisLoadError, reload: reloadDevis,
    onSaveDevis, onCreateDevis, onDuplicateDevis, onCreateIndice, onDeleteDevis, goDevis,
  } = useDevis(user, { ...saveCallbacks, setTab, effectivePlan, weekCount, stickyDevisThisWeek, onDevisCreated, onQuotaReached, isAdmin });
  const {
    invoices, selI, flushInvoiceSave, onSaveInvoice,
    loaded: invoicesLoaded, loadError: invoicesLoadError, reload: reloadInvoices, onCreateInvoiceFromDevis, onCreateEmptyInvoice,
    onCreateAcompte, onCreateSolde, onCreateAvoir, onDeleteInvoice, goInvoice,
  } = useInvoices(user, devis, brand, { ...saveCallbacks, setTab, clients });
  // Accueil : prêt quand devis ET factures sont chargés ; « Réessayer »
  // relance seulement ce qui a échoué.
  const dashboardLoaded = devisLoaded && invoicesLoaded;
  const dashboardLoadError = (!devisLoaded && devisLoadError) || (!invoicesLoaded && invoicesLoadError) || null;
  const reloadDashboard = () => {
    if (!devisLoaded && devisLoadError) reloadDevis();
    if (!invoicesLoaded && invoicesLoadError) reloadInvoices();
  };

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
        if (!token) throw new Error("Tu dois être connecté.");
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

  // Les fiches gardent l'onglet de leur liste allumé (client_detail → clients).
  const activeNav = tab === "client_detail" ? "clients" : (NAV.find(n => tab.startsWith(n.id))?.id || "dashboard");

  // Compteurs pour les pastilles des onglets de la BottomNav.
  // - Devis : en attente de signature ou en négociation (le client a
  //   envoyé une demande de modification → action requise côté artisan).
  // - Factures : émises non payées.
  const negociationsCount = devis.filter(d => d.statut === "en_negociation").length;
  const navBadges = {
    devis:    devis.filter(d => ["en_signature", "en_negociation"].includes(d.statut)).length,
    factures: invoices.filter(i => i.statut === "envoyee").length,
  };

  // Sheet d'actions rapides déclenchée par appui long sur le CTA Agent IA.
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const agentSheetActions = [
    {
      id: "voice",
      label: "Démarrage vocal",
      hint: "Dicte ton devis, l'IA le rédige",
      icon: I.spark,
      onClick: () => { setTab("agent"); try { localStorage.setItem("agentIA_autoStartMic", "1"); } catch {} },
    },
    {
      id: "blank",
      label: "Nouveau devis",
      hint: "Repartir d'un brouillon vierge",
      icon: I.file,
      onClick: () => { setTab("agent"); try { localStorage.setItem("agentIA_resetDraft", "1"); } catch {} },
    },
    {
      id: "list",
      label: "Voir mes devis",
      hint: `${devis?.length || 0} devis enregistré${(devis?.length || 0) > 1 ? "s" : ""}`,
      icon: I.users,
      onClick: () => setTab("devis"),
    },
  ];

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
  const recomputeShellHeight = useCallback(() => {
    const vvh = window.visualViewport?.height || 0;
    const iwh = window.innerHeight || 0;
    // Body toujours dimensionné au MAX(visualViewport, innerHeight) :
    // - Sur iPhone Dynamic Island en PWA standalone, vvh peut être
    //   inférieur à iwh même clavier fermé (zone home indicator) →
    //   Math.max garantit que le body couvre la totalité du viewport.
    // - On ne shrink PLUS le body à l'ouverture du clavier : la zone
    //   de saisie d'AgentIA est désormais `position: fixed` au-dessus
    //   du clavier via le hook `useKeyboardInset` (pas besoin de
    //   réduire toute la page).
    // Bug iOS PWA : zone d'affichage amputée de la barre d'état (59 px) après
    // un passage du clavier. On rallonge la page et on redescend les
    // éléments ancrés en bas d'autant (--ios-viewport-gap, cf. BottomNav).
    const gap = iosViewportGap({
      outerHeight: window.outerHeight, innerHeight: iwh, visualHeight: vvh, standalone: isStandalone(),
    });
    document.documentElement.style.setProperty("--ios-viewport-gap", gap + "px");
    const h = (Math.max(vvh, iwh) || iwh || vvh) + gap;
    document.documentElement.style.height = h + "px";
    document.body.style.height = h + "px";
    // #root est position:fixed : sans hauteur explicite il suit la zone
    // d'affichage raccourcie par iOS au lieu de la page.
    const root = document.getElementById("root");
    if (root) root.style.height = h + "px";
    // iOS PWA : annule tout auto-scroll de la window que iOS aurait
    // déclenché pour amener un input dans la vue (inutile maintenant
    // que la zone de saisie suit le clavier en position fixed).
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }, []);
  useLayoutEffect(() => {
    recomputeShellHeight();
    // Fermeture du clavier / retour dans l'appli : iOS ne signale pas
    // toujours le changement de taille par un « resize » ; on remesure après
    // l'animation du clavier.
    let later;
    const recomputeLater = () => { clearTimeout(later); later = setTimeout(recomputeShellHeight, 350); };
    window.visualViewport?.addEventListener("resize", recomputeShellHeight);
    window.addEventListener("resize", recomputeShellHeight);
    window.addEventListener("orientationchange", recomputeShellHeight);
    window.addEventListener("focusout", recomputeLater);
    window.addEventListener("pageshow", recomputeLater);
    document.addEventListener("visibilitychange", recomputeLater);
    return () => {
      clearTimeout(later);
      window.visualViewport?.removeEventListener("resize", recomputeShellHeight);
      window.removeEventListener("resize", recomputeShellHeight);
      window.removeEventListener("orientationchange", recomputeShellHeight);
      window.removeEventListener("focusout", recomputeLater);
      window.removeEventListener("pageshow", recomputeLater);
      document.removeEventListener("visibilitychange", recomputeLater);
    };
  }, [recomputeShellHeight]);
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
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: ZB.paper, fontFamily: ZB.font, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "#1A1612" }}>bat</span>
          </div>
          {!checkoutError ? (
            <>
              <div style={{ fontSize: 16, color: "#1A1612", fontWeight: 600, marginBottom: 8 }}>Redirection vers le paiement…</div>
              <div style={{ fontSize: 13, color: "#6B6358", lineHeight: 1.6 }}>Tu vas être redirigé vers Stripe pour finaliser ton abonnement.</div>
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
    <div style={{ fontFamily: ZB.font, color: ZB.ink, height: "100%", display: "flex", flexDirection: "column", background: ZB.paper, overflow: "hidden", position: "relative" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;overflow:hidden}
        /* iOS PWA standalone : sans position:fixed, iOS scrolle la
           window pour amener l'input focused dans la vue → l'input
           remonte tout en haut et le fond #1A1612 transparaît dans
           la zone que la window scroll a fait dépasser. Ancrer
           body+#root au viewport supprime totalement la scroll de
           document, et notre setH gère la hauteur dynamiquement. */
        body,#root{position:fixed;inset:0}
        html,body{background:#1A1612}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:${ZB.rule};border-radius:3px}
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
          .app-content{padding-bottom:0 !important}
          .app-toast{bottom:24px !important;left:auto !important;right:24px !important;max-width:380px}
          /* La barre de saisie AgentIA est position:fixed left:0 right:0 pour
             couvrir tout le viewport mobile. Sur desktop, la sidebar (220px)
             occupe la gauche → on décale la barre pour ne pas déborder sous
             la sidebar. Bottom recalé à 0 car le BottomNav est caché en desktop. */
          .agent-input-bar{left:220px !important;bottom:0 !important}
        }
        @media (max-width:1023px){.app-sidebar{display:none !important}}
        .app-sidebar button:hover{background:rgba(255,255,255,.06) !important;color:${ZB.onInk} !important}
        .app-sidebar button.active-nav:hover{background:rgba(255,255,255,.1) !important;color:#FFFFFF !important}
        .app-header button:focus-visible{outline:2px solid ${ZB.accent};outline-offset:2px}
        /* Barre latérale encre : la terre cuite n'y atteint pas 3:1, anneau clair (comme la barre du bas) */
        .app-sidebar button:focus-visible{outline:2px solid ${ZB.onInk};outline-offset:-2px}
      `}</style>

      {/* Header */}
      {/* La bande sous l'heure reste encre : en PWA iOS la barre d'état
          (black-translucent) écrit en blanc par-dessus. */}
      <header className="app-header" style={{ flexShrink: 0, background: ZB.paper, borderBottom: `2px solid ${ZB.ink}` }}>
        <div aria-hidden="true" style={{ height: "env(safe-area-inset-top)", background: ZB.ink }}/>
        <div style={{ minHeight: 56, padding: "6px calc(14px + env(safe-area-inset-right)) 6px calc(18px + env(safe-area-inset-left))", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 onClick={onLogoTap} style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, color: ZB.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none" }}>
          {SCREEN_TITLES[tab] || "Zenbat"}
        </h1>
        {diagOpen && <ViewportDiag onClose={() => setDiagOpen(false)}/>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <SaveIndicator state={saveState}/>
          <HeaderMenu
            isAdmin={isAdmin}
            user={user}
            effectivePlan={effectivePlan}
            billingCycle={billingCycle}
            weekCount={devisThisWeekCount}
            weekLimit={FREEMIUM_WEEKLY_DEVIS_LIMIT}
            supportUnread={supportUnread}
            onOpenAdmin={() => setTab("admin")}
            onOpenProfile={() => setScreen("onboarding")}
            onOpenSubscription={() => setScreen("subscription")}
            onOpenPaywall={() => setScreen("paywall")}
            onOpenSupport={tab !== "agent" && tab !== "admin" ? () => setSupportOpen(true) : null}
            onOpenComptable={() => setComptableOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>
        </div>
      </header>

      {/* Compteur quota devis freemium (hebdomadaire) */}
      {isFreemium && devisThisWeekCount > 0 && (
        <button onClick={() => setScreen("paywall")}
          style={{ flexShrink: 0, width: "100%", minHeight: 44, background: freemiumQuotaReached ? ZB.dangerSoft : ZB.paper2, border: "none", borderBottom: `1px solid ${ZB.rule}`, padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", color: freemiumQuotaReached ? ZB.danger : ZB.ink2, fontSize: 13, fontWeight: 600 }}>
          {freemiumQuotaReached
            ? `Limite atteinte : ${FREEMIUM_WEEKLY_DEVIS_LIMIT} devis sur ${FREEMIUM_WEEKLY_DEVIS_LIMIT} cette semaine.`
            : `${devisThisWeekCount} devis sur ${FREEMIUM_WEEKLY_DEVIS_LIMIT} cette semaine.`}
          <span style={{ color: ZB.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>Passer en Pro</span>
        </button>
      )}

      {/* Email pas encore confirmé : bandeau dans la colonne (ne rogne pas l'app) */}
      {emailVerification && <EmailVerificationBanner blocking={!!emailVerification.blocking}/>}

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar desktop */}
        <nav className="app-sidebar" aria-label="Navigation" style={{ display: "none", width: 220, flexDirection: "column", gap: 2, background: ZB.ink, flexShrink: 0, padding: "10px 10px", overflowY: "auto" }}>
          {NAV.map(({ id, label, icon }) => {
            const active = activeNav === id;
            const badgeCount = navBadges[id] || 0;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={active ? "active-nav" : ""} aria-current={active ? "page" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "10px 12px", borderRadius: 8, background: active ? "rgba(255,255,255,.1)" : "transparent", border: "none", color: active ? "#FFFFFF" : ZB.onInk2, cursor: "pointer", width: "100%", textAlign: "left", fontSize: 15, fontWeight: active ? 700 : 500, transition: "background .15s, color .15s", position: "relative" }}>
                {icon}
                {/* Même repère que la barre du bas : un trait terre cuite. */}
                <span style={active ? { textDecoration: "underline", textDecorationColor: ZB.accent, textDecorationThickness: 2, textUnderlineOffset: 6 } : undefined}>{label}</span>
                {id === "agent" && isFreemium && freemiumQuotaReached && (
                  <span aria-label="Limite atteinte" style={{ marginLeft: "auto", width: 10, height: 10, borderRadius: "50%", background: ZB.danger, boxShadow: `0 0 0 2px ${ZB.onInk}` }}/>
                )}
                {id !== "agent" && badgeCount > 0 && (
                  <span style={{ marginLeft: "auto", background: ZB.accent, color: "white", fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 10, minWidth: 20, textAlign: "center" }}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Contenu principal */}
        <div ref={contentRef} className="app-content" style={{ flex: 1, overflowY: "auto", paddingBottom: keyboardOpen ? 0 : NAV_RESERVED_CSS }}>
          {tab === "dashboard"     && <Dashboard devis={devis} invoices={invoices} clients={clients} goDevis={goDevis} goInvoice={goInvoice} setTab={setTab} brand={brand}
                                         loaded={dashboardLoaded} loadError={dashboardLoadError} onRetry={reloadDashboard}
                                         onOpenProfile={() => setScreen("onboarding")}
                                         onOpenPWAInstall={() => setScreen("pwa_install")}/>}
          {tab === "clients"       && <ClientsList clients={clients} onSave={onSaveClient} onDelete={onDeleteClient} onRestore={onRestoreClient} goClient={id => { setSelC(id); setTab("client_detail"); }} showUndo={showUndo}
                                         loaded={clientsLoaded} loadError={clientsLoadError} onRetry={reloadClients}/>}
          {tab === "client_detail" && selC && (
            <ClientDetail
              c={clients.find(x => x.id === selC)}
              clientDevis={devis.filter(d => d.client_id === selC)}
              onBack={() => setTab("clients")}
              goDevis={goDevis}
              onUpdate={onSaveClient}
              onDelete={async () => { await onDeleteClient(selC); setTab("clients"); }}
              onNewDevis={() => setTab("agent")}/>
          )}
          {tab === "devis"         && <DevisList devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} onDelete={onDeleteDevis} onDuplicate={onDuplicateDevis}
                                         loaded={devisLoaded} loadError={devisLoadError} onRetry={reloadDevis}/>}
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
                  onCreateSolde={onCreateSolde}
                  invoices={invoices}
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
          {tab === "factures"        && <InvoicesList invoices={invoices} clients={clients} goInvoice={goInvoice} onCreateEmpty={onCreateEmptyInvoice} onDelete={onDeleteInvoice} isFreemium={isFreemium} onPaywall={() => setScreen("paywall")}
                                           loaded={invoicesLoaded} loadError={invoicesLoadError} onRetry={reloadInvoices}/>}
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
                  onDelete={() => onDeleteInvoice(inv.id)}
                  flushSave={() => flushInvoiceSave(inv.id)}/>
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
      <SupportChat accent={ZB.accent} open={supportOpen} onClose={() => { setSupportOpen(false); refreshSupportUnread(); }}/>
      {comptableOpen && (
        <SendToComptableModal user={user} onClose={() => setComptableOpen(false)}/>
      )}
      <BottomNav
        items={NAV}
        activeNav={activeNav}
        onSelect={setTab}
        plan={effectivePlan}
        quotaReached={freemiumQuotaReached}
        firstDevisNudge={!isAdmin && (devis?.length || 0) === 0 && activeNav !== "agent"}
        badges={navBadges}
        onAgentLongPress={() => setAgentSheetOpen(true)}
      />
      <BottomNavActionSheet
        open={agentSheetOpen}
        onClose={() => setAgentSheetOpen(false)}
        actions={agentSheetActions}
      />
    </div>
  );
}

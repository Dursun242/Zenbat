import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./lib/auth.jsx";
import { startCheckout } from "./lib/stripe.js";

const fmt  = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n||0);
const fmtD = d => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const uid  = () => Math.random().toString(36).slice(2);

const DEMO_CLIENTS = [
  { id:"c1", type:"entreprise",  raison_sociale:"Alcéane Bailleur Social", email:"contact@alceane.fr",   ville:"Le Havre" },
  { id:"c2", type:"entreprise",  raison_sociale:"Eiffage Construction",    email:"normandie@eiffage.fr", ville:"Rouen"    },
  { id:"c3", type:"particulier", nom:"Martin", prenom:"Sophie",            email:"s.martin@gmail.com",   ville:"Caen"     },
];
const DEMO_LIGNES = [
  { id:"l1", type_ligne:"lot",     designation:"DÉMOLITION",           lot:""            },
  { id:"l2", type_ligne:"ouvrage", designation:"Dépose carrelage",     lot:"Démolition", unite:"m2", quantite:24, prix_unitaire:18   },
  { id:"l3", type_ligne:"ouvrage", designation:"Évacuation gravats",   lot:"Démolition", unite:"fg", quantite:1,  prix_unitaire:320  },
  { id:"l4", type_ligne:"lot",     designation:"REVÊTEMENTS",          lot:""            },
  { id:"l5", type_ligne:"ouvrage", designation:"Carrelage grès cérame",lot:"Revêtements",unite:"m2", quantite:24, prix_unitaire:55   },
  { id:"l6", type_ligne:"ouvrage", designation:"Faïence murale",       lot:"Revêtements",unite:"m2", quantite:18, prix_unitaire:48   },
  { id:"l7", type_ligne:"lot",     designation:"PLOMBERIE",            lot:""            },
  { id:"l8", type_ligne:"ouvrage", designation:"WC suspendu complet",  lot:"Plomberie",  unite:"u",  quantite:1,  prix_unitaire:650  },
  { id:"l9", type_ligne:"ouvrage", designation:"Douche italienne",     lot:"Plomberie",  unite:"u",  quantite:1,  prix_unitaire:1200 },
];
const ht0 = DEMO_LIGNES.filter(l=>l.type_ligne==="ouvrage").reduce((s,l)=>s+(l.quantite*l.prix_unitaire),0);
const DEMO_DEVIS = [
  { id:"d1", numero:"DEV-2026-0001", objet:"Réhabilitation Résidence Marceau", client_id:"c1", ville_chantier:"Le Havre", statut:"en_signature", montant_ht:142500, date_emission:"2026-04-01", lignes:[] },
  { id:"d2", numero:"DEV-2026-0002", objet:"Rénovation salle de bain T3",      client_id:"c3", ville_chantier:"Caen",     statut:"accepte",      montant_ht:ht0,    date_emission:"2026-03-15", lignes:DEMO_LIGNES },
  { id:"d3", numero:"DEV-2026-0003", objet:"Extension maison individuelle",    client_id:"c2", ville_chantier:"Rouen",    statut:"brouillon",    montant_ht:67200,  date_emission:"2026-04-10", lignes:[] },
];

const STATUT = {
  brouillon:    { label:"Brouillon",    bg:"#f1f5f9",color:"#64748b",dot:"#94a3b8" },
  envoye:       { label:"Envoyé",       bg:"#eff6ff",color:"#1d4ed8",dot:"#3b82f6" },
  en_signature: { label:"En signature", bg:"#fffbeb",color:"#b45309",dot:"#f59e0b" },
  accepte:      { label:"Accepté",      bg:"#ecfdf5",color:"#065f46",dot:"#10b981" },
  refuse:       { label:"Refusé",       bg:"#fef2f2",color:"#991b1b",dot:"#ef4444" },
};

function Badge({s}) {
  const c=STATUT[s]||STATUT.brouillon;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:c.bg,color:c.color,fontSize:10,fontWeight:600}}><span style={{width:6,height:6,borderRadius:"50%",background:c.dot}}/>{c.label}</span>;
}

const I = {
  home:  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9M9 21V12h6v9"/></svg>,
  users: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="8" cy="8" r="4"/><path d="M2 20c0-4 2.7-6 6-6s6 2 6 6M16 3.13a4 4 0 010 7.75M22 20c0-3.4-2-5-5-5.5"/></svg>,
  file:  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  spark: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 3l1.9 5.8L20 12l-6.1 3.2L12 21l-1.9-5.8L4 12l6.1-3.2z"/></svg>,
  send:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>,
  check: <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>,
  back:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,5 5,12 12,19"/></svg>,
  mic:   <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  x:     <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  wand:  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 4V2M15 16v-2M8 9H2M22 9h-4M17.8 11.8L19 13M15 9h.01M13.2 6.2L12 5M17.8 6.2L19 5M13.2 11.8L12 13"/><path d="M3 21l9-9"/></svg>,
  odoo:  <svg width="15" height="15" viewBox="0 0 24 24" fill="#714B67"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="12" r="3"/><circle cx="20" cy="12" r="3"/></svg>,
  trend: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
  img:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>,
  paint: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 13.5A9 9 0 0013.5 2"/><path d="M11 6l7 7-4 4-7-7"/><circle cx="18" cy="19" r="2"/></svg>,
  pdf:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13h8M8 17h5"/></svg>,
};

function Logo({size=22,white=false}) {
  return <span style={{fontWeight:800,fontSize:size,letterSpacing:"-0.5px"}}><span style={{color:"#22c55e"}}>Zen</span><span style={{color:white?"white":"#0f172a"}}>bat</span></span>;
}

const DEFAULT_BRAND = {
  companyName:"", logo:null, siret:"", tva:"",
  address:"", city:"", phone:"", email:"", website:"",
  color:"#22c55e", fontStyle:"modern",
  mentionsLegales:"", rib:"", iban:"", bic:"",
  paymentTerms:"Acompte 30% à la commande, solde à réception.",
  validityDays:30,
  trades:[],
};

// Liste des métiers principaux du BTP en France.
// L'utilisateur en sélectionne jusqu'à 5 pendant l'onboarding pour spécialiser
// l'agent IA et éviter qu'il génère des devis hors-périmètre.
const BTP_TRADES = [
  { id:"maconnerie",      label:"Maçonnerie",                icon:"🧱" },
  { id:"gros_oeuvre",     label:"Gros œuvre / Béton",        icon:"🏗️" },
  { id:"terrassement",    label:"Terrassement / VRD",        icon:"🚜" },
  { id:"charpente",       label:"Charpente",                 icon:"🪵" },
  { id:"couverture",      label:"Couverture / Zinguerie",    icon:"🏠" },
  { id:"etancheite",      label:"Étanchéité",                icon:"💧" },
  { id:"facade",          label:"Façade / Ravalement",       icon:"🏛️" },
  { id:"isolation",       label:"Isolation (ITE / ITI)",     icon:"🧊" },
  { id:"platrerie",       label:"Plâtrerie / Cloisons",      icon:"📐" },
  { id:"menuiserie_int",  label:"Menuiserie intérieure",     icon:"🚪" },
  { id:"menuiserie_ext",  label:"Menuiserie ext. / Alu",     icon:"🪟" },
  { id:"serrurerie",      label:"Serrurerie / Métallerie",   icon:"🔧" },
  { id:"plomberie",       label:"Plomberie",                 icon:"🚰" },
  { id:"sanitaire",       label:"Sanitaire / Salle de bain", icon:"🛁" },
  { id:"chauffage",       label:"Chauffage / PAC",           icon:"🔥" },
  { id:"climatisation",   label:"Climatisation / VMC",       icon:"❄️" },
  { id:"electricite",     label:"Électricité",               icon:"⚡" },
  { id:"domotique",       label:"Domotique / Courants faibles", icon:"📡" },
  { id:"peinture",        label:"Peinture / Décoration",     icon:"🎨" },
  { id:"carrelage",       label:"Carrelage / Faïence",       icon:"🟦" },
  { id:"sol_souple",      label:"Sols souples / Parquet",    icon:"🟫" },
  { id:"vitrerie",        label:"Vitrerie / Miroiterie",     icon:"🪞" },
  { id:"cuisine",         label:"Cuisine / Agencement",      icon:"🍳" },
  { id:"piscine",         label:"Piscine / Spa",             icon:"🏊" },
  { id:"paysagiste",      label:"Paysagiste / Espaces verts",icon:"🌳" },
  { id:"demolition",      label:"Démolition / Désamiantage", icon:"🧨" },
];
const tradesLabels = (ids=[]) => ids.map(id => BTP_TRADES.find(t=>t.id===id)?.label).filter(Boolean);

const TX = {
  dashboard:"Accueil", clients:"Clients", devis:"Devis", agent:"Agent IA",
  myProfile:"Mon profil",
  recentQuotes:"Devis récents", seeAll:"Voir tout →",
  aiAgent:"Agent IA — Créer un devis", aiDesc:"Décrivez les travaux, je génère le devis",
  signedCA:"CA signé HT", inProgress:"En cours", accepted:"Acceptés",
  saveQuote:"✓ Enregistrer le devis", clearQuote:"🗑 Effacer",
  inputPlaceholder:"Décris les travaux dans ta langue — réponse en français",
  inputHint:"Entrée pour envoyer · les lignes s'ajoutent en direct",
  agentGreeting:"Bonjour 👋 Décrivez-moi les travaux ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige systématiquement le devis en français professionnel.\n\nEx : *Pose carrelage 25€/m² pour 40m², fourniture carrelage 18€/m²*",
  errNetwork:"Pas de connexion internet. Vérifiez votre réseau et réessayez.",
  errApi:"L'assistant IA ne répond pas. Réessayez dans quelques secondes.",
  errGeneral:"Quelque chose s'est mal passé. Réessayez.",
  quoteInProgress:"Devis en cours",
  linesAdded:"Lignes ajoutées au devis ✓",
  quoteSaved:"✅ Devis enregistré ! Retrouvez-le dans l'onglet Devis.\n\nNouvel autre chantier ?",
  viaPdf:"Voir le PDF du devis",
  sendOdoo:"Envoyer en signature Odoo Sign",
  help_dashboard:"👆 Appuyez sur un devis pour l'ouvrir\n📊 Les chiffres résument votre activité\n🤖 Le bouton vert lance l'agent IA pour créer un devis",
  help_clients:"👆 Appuyez sur un client pour voir ses infos\n➕ Créez un client avec le bouton en haut",
  help_devis:"👆 Appuyez sur un devis pour l'ouvrir\n🔍 Filtrez par statut avec les boutons\n🤖 Créez un devis rapidement via l'Agent IA",
  help_agent:"💬 Décrivez les travaux en bas\nEx : pose carrelage 25€/m² pour 40m²\n📋 Les lignes apparaissent automatiquement\n✅ Enregistrez le devis une fois terminé",
};

export default function App() {
  const [screen, setScreen] = useState("app");
  const [brand,  setBrand]  = useState({...DEFAULT_BRAND, companyName:"Maçonnerie Dupont SAS", city:"76600 Le Havre", phone:"02 35 12 34 56", email:"contact@dupont-maconnerie.fr", siret:"12345678900010", color:"#22c55e", fontStyle:"modern", paymentTerms:"Acompte 30% à la commande, solde à réception.", mentionsLegales:"Assurance décennale n°12345 — Garantie biennale incluse — TVA 20%", rib:"Crédit Mutuel Le Havre", iban:"FR76 1234 5678 9012 3456 7890 123", bic:"CMCIFRPP", validityDays:30, trades:["maconnerie","gros_oeuvre","carrelage","platrerie","peinture"]});
  const [clients,setClients]= useState(DEMO_CLIENTS);
  const [devis,  setDevis]  = useState(DEMO_DEVIS);
  const [tab,    setTab]    = useState("dashboard");
  const [selD,   setSelD]   = useState(null);
  const [selC,   setSelC]   = useState(null);
  const [plan,   setPlan]   = useState("free");
  const TRIAL_DAYS = 30;
  const { user } = useAuth();

  // Préremplissage du brand depuis les infos saisies à l'inscription (user_metadata Supabase).
  // N'écrase que les champs laissés vides — on ne touche pas à ce que l'utilisateur a déjà personnalisé.
  useEffect(() => {
    const m = user?.user_metadata;
    if (!m) return;
    setBrand(b => {
      const cityLine = [m.postal_code, m.city].filter(Boolean).join(" ").trim();
      return {
        ...b,
        companyName: b.companyName || m.company_name || "",
        siret:       b.siret       || m.siret        || "",
        phone:       b.phone       || m.phone        || "",
        city:        b.city        || cityLine       || "",
        email:       b.email       || user.email     || "",
      };
    });
  }, [user]);

  // L'essai démarre à la date de création du compte Supabase (auth.users.created_at).
  // Fallback localStorage si pas encore d'utilisateur (rendu pendant le chargement de la session).
  const trialStart = (() => {
    if (user?.created_at) return new Date(user.created_at).getTime();
    if (typeof window === "undefined") return Date.now();
    const stored = localStorage.getItem("zenbat_trial_start");
    if (stored) return Number(stored);
    const now = Date.now();
    localStorage.setItem("zenbat_trial_start", String(now));
    return now;
  })();
  const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - trialStart) / 86400000));
  const trialExpired = plan === "free" && daysLeft === 0;

  const goDevis  = id => { setSelD(id); setTab("devis_detail"); };
  const goClient = id => { setSelC(id); setTab("client_detail"); };

  const stats = {
    clients: clients.length,
    acceptes:devis.filter(d=>d.statut==="accepte").length,
    ca:      devis.filter(d=>d.statut==="accepte").reduce((s,d)=>s+d.montant_ht,0),
    enCours: devis.filter(d=>["envoye","en_signature"].includes(d.statut)).length,
  };

  const NAV = [
    {id:"dashboard",label:"Accueil",   icon:I.trend},
    {id:"clients",  label:"Clients",   icon:I.users},
    {id:"devis",    label:"Devis",     icon:I.file},
    {id:"agent",    label:"Agent IA",  icon:I.spark},
  ];
  const activeNav = NAV.find(n=>tab.startsWith(n.id))?.id||"dashboard";

  if (screen==="auth")       return <AuthScreen onEnter={co=>{setBrand(b=>({...b,companyName:co||""}));setScreen("onboarding");}}/>;
  if (screen==="onboarding") return <Onboarding brand={brand} setBrand={setBrand} onDone={()=>setScreen("app")}/>;
  if (screen==="paywall")    return <PaywallScreen daysLeft={daysLeft} onBack={()=>setScreen("app")}/>;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",height:"100dvh",display:"flex",flexDirection:"column",background:"#f8fafc",overflow:"hidden"}}>
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
      `}</style>

      <header style={{background:"#0f172a",padding:"calc(10px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 10px calc(18px + env(safe-area-inset-left))",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <Logo size={20} white/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setScreen("onboarding")}
            style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:5,color:"#94a3b8",fontSize:11,fontWeight:500,cursor:"pointer"}}>
            {I.paint} Mon profil
          </button>
          {plan==="pro"
            ? <span style={{background:"rgba(34,197,94,.15)",color:"#4ade80",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,border:"1px solid rgba(34,197,94,.25)"}}>PRO</span>
            : <span style={{background:daysLeft<=7?"rgba(249,115,22,.15)":"#1e293b",color:daysLeft<=7?"#fb923c":"#94a3b8",fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:20,border:daysLeft<=7?"1px solid rgba(249,115,22,.25)":"none"}}>Essai · {daysLeft}j</span>
          }
        </div>
      </header>

      <div style={{flex:1,overflowY:"auto",paddingBottom:"calc(64px + env(safe-area-inset-bottom))"}}>
        {tab==="dashboard"    && <Dashboard stats={stats} devis={devis} clients={clients} goDevis={goDevis} setTab={setTab} brand={brand}/>}
        {tab==="clients"      && <ClientsList clients={clients} goClient={goClient}/>}
        {tab==="client_detail"&& selC && <ClientDetail c={clients.find(x=>x.id===selC)} clientDevis={devis.filter(d=>d.client_id===selC)} onBack={()=>setTab("clients")} goDevis={goDevis}/>}
        {tab==="devis"        && <DevisList devis={devis} clients={clients} goDevis={goDevis} setTab={setTab}/>}
        {tab==="devis_detail" && selD && (
          <DevisDetail d={devis.find(x=>x.id===selD)} cl={clients.find(c=>c.id===devis.find(x=>x.id===selD)?.client_id)}
            onBack={()=>setTab("devis")} brand={brand}
            onChange={u=>setDevis(ds=>ds.map(x=>x.id===selD?u:x))}/>
        )}
        {tab==="agent" && <AgentIA devis={devis} setDevis={setDevis} clients={clients} plan={plan} trialExpired={trialExpired} onPaywall={()=>setScreen("paywall")} setTab={setTab} brand={brand}/>}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,paddingBottom:"env(safe-area-inset-bottom)",background:"#0f172a",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",zIndex:50}}>
        {NAV.map(({id,label,icon})=>{
          const active=activeNav===id;
          return (
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0",background:"none",border:"none",color:active?"#22c55e":"#64748b",position:"relative",cursor:"pointer"}}>
              {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2.5,background:"#22c55e",borderRadius:2}}/>}
              <div style={{position:"relative"}}>
                {icon}
                {id==="agent"&&plan==="free"&&daysLeft<=7&&<span style={{position:"absolute",top:-4,right:-10,background:daysLeft===0?"#ef4444":"#f97316",color:"white",fontSize:8,fontWeight:700,padding:"0 4px",height:14,minWidth:14,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>{daysLeft===0?"!":`${daysLeft}j`}</span>}
              </div>
              <span style={{fontSize:10,fontWeight:active?700:400}}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Onboarding({brand,setBrand,onDone}) {
  const [step,setStep] = useState(0);
  const [local,setLocal]= useState({...brand});
  const set = (k,v) => setLocal(b=>({...b,[k]:v}));
  const fileRef = useRef(null);

  const handleLogo = e => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => set("logo", ev.target.result);
    reader.readAsDataURL(f);
  };

  const FONTS = [
    {id:"modern",   label:"Moderne",   sample:"DM Sans"},
    {id:"elegant",  label:"Élégant",   sample:"Playfair Display"},
    {id:"tech",     label:"Tech",      sample:"Space Grotesk"},
  ];

  const COLORS = ["#22c55e","#3b82f6","#f97316","#8b5cf6","#ef4444","#0891b2","#0f172a","#d97706"];

  const STEPS = [
    { title:"Votre identité",          icon:"🏢" },
    { title:"Vos métiers BTP",         icon:"🛠️" },
    { title:"Coordonnées",             icon:"📍" },
    { title:"Apparence PDF",           icon:"🎨" },
    { title:"Informations légales",    icon:"📋" },
  ];

  const toggleTrade = (id) => setLocal(b => {
    const cur = b.trades || [];
    if (cur.includes(id)) return {...b, trades: cur.filter(x=>x!==id)};
    if (cur.length >= 5) return b;
    return {...b, trades: [...cur, id]};
  });

  const save = () => { setBrand(local); onDone(); };

  const fontFamily = local.fontStyle==="elegant"?"Playfair Display":local.fontStyle==="tech"?"Space Grotesk":"DM Sans";

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:inherit}@keyframes popIn{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}.pop{animation:popIn .25s ease both}`}</style>

      {/* Progress */}
      <div style={{padding:"16px 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <Logo size={18} white/>
          <span style={{color:"#64748b",fontSize:11}}>{step+1} / {STEPS.length}</span>
        </div>
        <div style={{height:3,background:"#1e293b",borderRadius:2}}>
          <div style={{height:"100%",background:"#22c55e",borderRadius:2,transition:"width .4s ease",width:`${((step+1)/STEPS.length)*100}%`}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
          {STEPS.map((s,i)=>(
            <span key={i} style={{fontSize:10,color:i<=step?"#22c55e":"#475569",fontWeight:i===step?600:400}}>{s.icon}</span>
          ))}
        </div>
      </div>

      <div style={{flex:1,padding:"20px 20px 100px",overflowY:"auto"}}>
        <h2 style={{color:"white",fontSize:20,fontWeight:700,marginBottom:4}} className="pop">{STEPS[step].icon} {STEPS[step].title}</h2>
        <p style={{color:"#64748b",fontSize:12,marginBottom:20}}>Votre devis PDF sera personnalisé automatiquement</p>

        {/* STEP 0 — Identité */}
        {step===0&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Logo upload */}
            <div style={{background:"#1e293b",borderRadius:16,padding:18,border:"2px dashed #334155",textAlign:"center",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
              {local.logo
                ? <img src={local.logo} alt="logo" style={{maxHeight:80,maxWidth:"100%",borderRadius:8,margin:"0 auto",display:"block"}}/>
                : <div>
                    <div style={{color:"#22c55e",marginBottom:8}}>{I.img}</div>
                    <div style={{color:"#94a3b8",fontSize:13,fontWeight:500}}>Cliquez pour uploader votre logo</div>
                    <div style={{color:"#475569",fontSize:11,marginTop:4}}>PNG, JPG — recommandé 400×100px</div>
                  </div>
              }
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogo}/>
            </div>
            {local.logo&&<button onClick={()=>set("logo",null)} style={{background:"none",border:"1px solid #334155",borderRadius:10,padding:"7px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Supprimer le logo</button>}

            <Field dark label="Nom de l'entreprise *" val={local.companyName} onChange={v=>set("companyName",v)} placeholder="Ex : Maçonnerie Dupont SAS"/>
            <Field dark label="SIRET" val={local.siret} onChange={v=>set("siret",v)} placeholder="12345678900010"/>
            <Field dark label="N° TVA intracommunautaire" val={local.tva} onChange={v=>set("tva",v)} placeholder="FR12345678901"/>
          </div>
        )}

        {/* STEP 1 — Métiers BTP */}
        {step===1&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#1e3a2f",border:"1px solid rgba(34,197,94,.3)",borderRadius:12,padding:"10px 14px"}}>
              <div style={{color:"#86efac",fontSize:12,fontWeight:600,marginBottom:2}}>Choisissez jusqu'à 5 métiers</div>
              <div style={{color:"#94a3b8",fontSize:11,lineHeight:1.5}}>L'agent IA générera uniquement des devis pour vos métiers. Hors-sujet refusé automatiquement.</div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#64748b"}}>
              <span>{(local.trades||[]).length} / 5 sélectionnés</span>
              {(local.trades||[]).length>0 && <button onClick={()=>set("trades",[])} style={{background:"none",border:"none",color:"#64748b",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Réinitialiser</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {BTP_TRADES.map(t => {
                const selected = (local.trades||[]).includes(t.id);
                const disabled = !selected && (local.trades||[]).length >= 5;
                return (
                  <button key={t.id} onClick={()=>toggleTrade(t.id)} disabled={disabled}
                    style={{
                      background: selected ? "#1e3a2f" : "#1e293b",
                      border: `1.5px solid ${selected ? "#22c55e" : "#334155"}`,
                      borderRadius: 12,
                      padding: "10px 8px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                      transition: "all .15s",
                      minHeight: 64,
                    }}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontSize:10,fontWeight:600,color:selected?"#86efac":"#cbd5e1",textAlign:"center",lineHeight:1.2}}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 — Coordonnées */}
        {step===2&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Field dark label="Adresse" val={local.address} onChange={v=>set("address",v)} placeholder="12 rue des Artisans"/>
            <Field dark label="Ville / Code postal" val={local.city} onChange={v=>set("city",v)} placeholder="76600 Le Havre"/>
            <Field dark label="Téléphone" val={local.phone} onChange={v=>set("phone",v)} placeholder="02 35 00 00 00"/>
            <Field dark label="Email professionnel" val={local.email} onChange={v=>set("email",v)} placeholder="contact@monentreprise.fr"/>
            <Field dark label="Site web" val={local.website} onChange={v=>set("website",v)} placeholder="www.monentreprise.fr"/>
          </div>
        )}

        {/* STEP 3 — Apparence */}
        {step===3&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Couleur principale */}
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>COULEUR PRINCIPALE</label>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {COLORS.map(c=>(
                  <button key={c} onClick={()=>set("color",c)}
                    style={{width:36,height:36,borderRadius:"50%",background:c,border:local.color===c?"3px solid white":"3px solid transparent",cursor:"pointer",boxShadow:local.color===c?"0 0 0 2px "+c:"none",transition:"all .2s"}}/>
                ))}
                <div style={{position:"relative"}}>
                  <input type="color" value={local.color} onChange={e=>set("color",e.target.value)}
                    style={{width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",padding:0,background:"none"}}/>
                </div>
              </div>
            </div>

            {/* Police */}
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>STYLE DE POLICE</label>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {FONTS.map(f=>(
                  <button key={f.id} onClick={()=>set("fontStyle",f.id)}
                    style={{background:local.fontStyle===f.id?"#1e3a2f":"#1e293b",border:`1.5px solid ${local.fontStyle===f.id?"#22c55e":"#334155"}`,borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .2s"}}>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontFamily:f.sample,fontSize:16,color:"white",fontWeight:700}}>Devis Professionnel</div>
                      <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{f.label}</div>
                    </div>
                    {local.fontStyle===f.id&&<div style={{color:"#22c55e"}}>{I.check}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Prévisualisation mini */}
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:10}}>APERÇU ENTÊTE PDF</label>
              <div style={{background:"white",borderRadius:12,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
                <div style={{background:local.color,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {local.logo
                    ? <img src={local.logo} alt="" style={{height:32,maxWidth:120,objectFit:"contain"}}/>
                    : <span style={{fontFamily:fontFamily,fontWeight:700,fontSize:16,color:"white"}}>{local.companyName||"Votre Entreprise"}</span>
                  }
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:fontFamily,color:"rgba(255,255,255,.9)",fontWeight:700,fontSize:13}}>DEVIS</div>
                    <div style={{color:"rgba(255,255,255,.6)",fontSize:10}}>DEV-2026-0001</div>
                  </div>
                </div>
                <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{fontSize:10,color:"#94a3b8",fontFamily:fontFamily}}>DESTINATAIRE</div>
                  <div style={{fontSize:12,fontWeight:600,color:"#0f172a",fontFamily:fontFamily,marginTop:2}}>Client Exemple</div>
                </div>
                <div style={{padding:"8px 16px",display:"flex",justifyContent:"flex-end"}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:"#94a3b8"}}>Total TTC</div>
                    <div style={{fontSize:16,fontWeight:700,color:local.color,fontFamily:fontFamily}}>12 500,00 €</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 — Légal */}
        {step===4&&(
          <div className="pop" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Field dark label="RIB / Nom de la banque" val={local.rib} onChange={v=>set("rib",v)} placeholder="Crédit Mutuel — Agence Le Havre"/>
            <Field dark label="IBAN" val={local.iban} onChange={v=>set("iban",v)} placeholder="FR76 1234 5678 9012 3456 7890 123"/>
            <Field dark label="BIC / SWIFT" val={local.bic} onChange={v=>set("bic",v)} placeholder="CMCIFRPP"/>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>CONDITIONS DE PAIEMENT</label>
              <textarea value={local.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} rows={3}
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>MENTIONS LÉGALES (pied de devis)</label>
              <textarea value={local.mentionsLegales} onChange={e=>set("mentionsLegales",e.target.value)} rows={4}
                placeholder="Ex : Assurance décennale n°... — Garantie biennale — TVA non applicable art. 293B..."
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none",resize:"none","::placeholder":{color:"#475569"}}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>VALIDITÉ DU DEVIS (jours)</label>
              <input type="number" value={local.validityDays} onChange={e=>set("validityDays",parseInt(e.target.value)||30)}
                style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"10px 14px",fontSize:13,color:"white",outline:"none"}}/>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",borderTop:"1px solid #1e293b",padding:"14px 20px",display:"flex",gap:10}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>}
        {step<STEPS.length-1
          ? <button onClick={()=>setStep(s=>s+1)} style={{flex:2,background:"#22c55e",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Continuer →</button>
          : <button onClick={save} style={{flex:2,background:"#22c55e",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>✓ Enregistrer et commencer</button>
        }
      </div>
    </div>
  );
}

function Field({dark,label,val,onChange,placeholder,type="text"}) {
  return (
    <div>
      <label style={{display:"block",fontSize:11,fontWeight:600,color:dark?"#94a3b8":"#64748b",marginBottom:6}}>{label}</label>
      <input type={type} value={val||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:dark?"#1e293b":"white",border:`1px solid ${dark?"#334155":"#e2e8f0"}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:dark?"white":"#0f172a",outline:"none"}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  PDF LIVE VIEWER (simulé avec HTML)
// ══════════════════════════════════════════════════════════
function PDFViewer({d, cl, brand, onClose}) {
  const MM_TO_PX = 3.7795275591;
  const A4_PX = 210 * MM_TO_PX;
  const wrapRef = useRef(null);
  const pageRef = useRef(null);
  const [fitScale, setFitScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const avail = Math.max(240, window.innerWidth - 32);
    return Math.min(1, avail / A4_PX);
  });
  const [userZoom, setUserZoom] = useState(1);
  const scale = fitScale * userZoom;
  const [pageH, setPageH] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const compute = () => {
      const w = wrapRef.current?.clientWidth || (window.innerWidth - 32);
      setFitScale(Math.min(1, w / A4_PX));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pageRef.current) return;
    const measure = () => {
      const h = pageRef.current?.offsetHeight || 0;
      setPageH(h * scale);
    };
    measure();
    const id = setTimeout(measure, 50);
    return () => clearTimeout(id);
  }, [scale, d.numero]);

  const lignes = d.lignes?.length ? d.lignes : DEMO_LIGNES;
  const ouvrages = lignes.filter(l=>l.type_ligne==="ouvrage");
  const rateOf = (l)=> Number(l.tva_rate ?? d.tva_rate ?? 20);
  const ht  = ouvrages.reduce((s,l)=>s+((l.quantite||0)*(l.prix_unitaire||0)),0);
  // Regroupement par taux de TVA
  const tvaGroups = ouvrages.reduce((acc,l)=>{
    const r = rateOf(l);
    const lineHt = (l.quantite||0)*(l.prix_unitaire||0);
    acc[r] = (acc[r]||0) + lineHt;
    return acc;
  },{});
  const tvaRows = Object.keys(tvaGroups).map(r=>Number(r)).sort((a,b)=>a-b).map(r=>({
    rate: r,
    base: tvaGroups[r],
    montant: tvaGroups[r] * (r/100),
  }));
  const tva = tvaRows.reduce((s,row)=>s+row.montant,0);
  const ttc = ht + tva;
  const fontFamily = brand.fontStyle==="elegant"?"Playfair Display":brand.fontStyle==="tech"?"Space Grotesk":"DM Sans";
  const navy = "#1e3a5f";
  const validUntil = new Date(d.date_emission);
  validUntil.setDate(validUntil.getDate()+(brand.validityDays||30));
  const clientName = cl?.raison_sociale || `${cl?.prenom||""} ${cl?.nom||""}`.trim() || "—";

  const clientLines = [
    cl?.adresse,
    [cl?.code_postal, cl?.ville].filter(Boolean).join(" "),
    cl?.email,
    cl?.telephone && `Tél : ${cl.telephone}`,
  ].filter(Boolean);

  const companyLines = [
    brand.address,
    [brand.postalCode, brand.city].filter(Boolean).join(" ") || brand.city,
    brand.phone && `Tél : ${brand.phone}`,
    brand.email,
    brand.siret && `SIRET : ${brand.siret}`,
  ].filter(Boolean);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:200,display:"flex",flexDirection:"column"}} className="fu pdf-modal">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body > *:not(.pdf-modal) { display: none !important; }
          .pdf-modal { position: static !important; background: white !important; }
          .pdf-modal .pdf-toolbar { display: none !important; }
          .pdf-modal .pdf-scroll { overflow: visible !important; padding: 0 !important; background: white !important; }
          .pdf-modal .pdf-page-wrap { width: auto !important; height: auto !important; }
          .pdf-modal .pdf-page { transform: none !important; position: static !important; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; width: 210mm !important; min-height: 297mm !important; max-width: none !important; }
        }
      `}</style>

      <div className="pdf-toolbar" style={{background:"#0f172a",padding:"calc(12px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 12px calc(18px + env(safe-area-inset-left))",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{color:"#22c55e"}}>{I.pdf}</div>
          <span style={{color:"white",fontSize:13,fontWeight:600}}>{d.numero}.pdf</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <div style={{display:"flex",background:"#1e293b",borderRadius:10,overflow:"hidden"}}>
            <button onClick={()=>setUserZoom(z=>Math.max(0.5, +(z-0.25).toFixed(2)))} style={{background:"none",border:"none",color:"#94a3b8",width:30,height:30,fontSize:16,cursor:"pointer",padding:0}} aria-label="Dézoomer">−</button>
            <button onClick={()=>setUserZoom(1)} style={{background:"none",border:"none",color:"#94a3b8",padding:"0 8px",fontSize:11,fontWeight:600,cursor:"pointer",minWidth:44}} aria-label="Réinitialiser zoom">{Math.round(scale*100)}%</button>
            <button onClick={()=>setUserZoom(z=>Math.min(3, +(z+0.25).toFixed(2)))} style={{background:"none",border:"none",color:"#94a3b8",width:30,height:30,fontSize:16,cursor:"pointer",padding:0}} aria-label="Zoomer">+</button>
          </div>
          <button onClick={()=>window.print()} style={{background:"#22c55e",color:"white",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⬇</button>
          <button onClick={onClose} style={{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:10,padding:"7px 10px",cursor:"pointer"}}>{I.x}</button>
        </div>
      </div>

      <div className="pdf-scroll" ref={wrapRef} style={{flex:1,overflow:"auto",padding:"16px 16px calc(20px + env(safe-area-inset-bottom))",background:"#1e293b"}}>
        <div className="pdf-page-wrap" style={{width:`calc(210mm * ${scale})`,height:pageH?`${pageH}px`:"auto",margin:"0 auto",position:"relative"}}>
        <div ref={pageRef} className="pdf-page" style={{background:"white",width:"210mm",minHeight:"297mm",boxShadow:"0 20px 60px rgba(0,0,0,.5)",padding:"15mm",fontFamily,color:"#1a1a1a",fontSize:11,lineHeight:1.5,boxSizing:"border-box",transform:`scale(${scale})`,transformOrigin:"top left",position:"absolute",top:0,left:0}}>

          {/* En-tête : n° devis + dates */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:12,borderBottom:`2px solid ${navy}`}}>
            <div>
              {brand.logo && <img src={brand.logo} alt="" style={{height:44,maxWidth:180,objectFit:"contain",display:"block",marginBottom:6}}/>}
              <div style={{fontWeight:800,fontSize:16,color:navy}}>{brand.companyName||"Votre Entreprise"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:"#94a3b8",fontSize:10,fontWeight:600,letterSpacing:"2px"}}>DEVIS</div>
              <div style={{color:navy,fontWeight:800,fontSize:20,marginTop:2}}>{d.numero}</div>
              <div style={{color:"#64748b",fontSize:10,marginTop:6}}>Émis le <strong style={{color:"#1a1a1a"}}>{fmtD(d.date_emission)}</strong></div>
              <div style={{color:"#64748b",fontSize:10}}>Valide jusqu'au <strong style={{color:"#1a1a1a"}}>{fmtD(validUntil.toISOString())}</strong></div>
            </div>
          </div>

          {/* Boxes ENTREPRISE / MAÎTRE D'OUVRAGE */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{border:"1px solid #d4d4d8",borderRadius:4,padding:"10px 12px",minHeight:110}}>
              <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>ENTREPRISE</div>
              <div style={{fontSize:13,fontWeight:700,color:"#111",marginBottom:4}}>{brand.companyName||"—"}</div>
              {companyLines.map((line,i)=>(<div key={i} style={{fontSize:10,color:"#4b5563",lineHeight:1.6}}>{line}</div>))}
            </div>
            <div style={{border:"1px solid #d4d4d8",borderRadius:4,padding:"10px 12px",minHeight:110}}>
              <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>MAÎTRE D'OUVRAGE</div>
              <div style={{fontSize:13,fontWeight:700,color:"#111",marginBottom:4}}>{clientName}</div>
              {clientLines.map((line,i)=>(<div key={i} style={{fontSize:10,color:"#4b5563",lineHeight:1.6}}>{line}</div>))}
            </div>
          </div>

          {/* Chantier */}
          {(d.ville_chantier||d.objet)&&(
            <div style={{background:"#f8f9fb",border:"1px solid #e5e7eb",borderRadius:4,padding:"8px 12px",marginBottom:14,fontSize:10,color:"#374151"}}>
              {d.objet && <div><strong>Objet :</strong> {d.objet}</div>}
              {d.ville_chantier && <div><strong>Chantier :</strong> {d.ville_chantier}</div>}
            </div>
          )}

          {/* Détail des prestations */}
          <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:8}}>DÉTAIL DES PRESTATIONS</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:14}}>
            <thead>
              <tr style={{background:navy,color:"white"}}>
                <th style={{textAlign:"left",padding:"8px 10px",fontWeight:600}}>Description</th>
                <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:50}}>Unité</th>
                <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:45}}>Qté</th>
                <th style={{textAlign:"right",padding:"8px 8px",fontWeight:600,width:70}}>PU HT</th>
                <th style={{textAlign:"center",padding:"8px 6px",fontWeight:600,width:50}}>TVA</th>
                <th style={{textAlign:"right",padding:"8px 10px",fontWeight:600,width:80}}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l,i)=>{
                if(l.type_ligne==="lot") return (
                  <tr key={l.id}>
                    <td colSpan={6} style={{padding:"8px 10px",fontWeight:700,fontSize:10,color:navy,textTransform:"uppercase",letterSpacing:".5px",borderBottom:`1px solid ${navy}33`,background:"#eef2f7"}}>{l.designation}</td>
                  </tr>
                );
                const total = (l.quantite||0)*(l.prix_unitaire||0);
                return (
                  <tr key={l.id} style={{background:i%2?"#f8f9fb":"white",borderBottom:"1px solid #e5e7eb"}}>
                    <td style={{padding:"7px 10px"}}>{l.designation}</td>
                    <td style={{padding:"7px 6px",textAlign:"center",color:"#6b7280"}}>{l.unite||"—"}</td>
                    <td style={{padding:"7px 6px",textAlign:"center"}}>{l.quantite}</td>
                    <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(l.prix_unitaire)}</td>
                    <td style={{padding:"7px 6px",textAlign:"center",color:"#6b7280"}}>{rateOf(l).toString().replace(".",",")}%</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600}}>{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totaux */}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
            <table style={{fontSize:10,borderCollapse:"collapse",minWidth:260}}>
              <tbody>
                <tr><td style={{padding:"4px 10px",color:"#4b5563"}}>Total HT</td><td style={{padding:"4px 10px",textAlign:"right",fontWeight:600}}>{fmt(ht)}</td></tr>
                {tvaRows.map(row=>(
                  <tr key={row.rate}>
                    <td style={{padding:"4px 10px",color:"#4b5563"}}>
                      TVA {row.rate.toString().replace(".",",")}%
                      <span style={{color:"#9ca3af",fontSize:9,marginLeft:4}}>(sur {fmt(row.base)})</span>
                    </td>
                    <td style={{padding:"4px 10px",textAlign:"right"}}>{fmt(row.montant)}</td>
                  </tr>
                ))}
                <tr style={{background:"#eef2f7",borderTop:`2px solid ${navy}`}}>
                  <td style={{padding:"8px 10px",fontWeight:800,color:navy,fontSize:11}}>TOTAL TTC</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,color:navy,fontSize:12}}>{fmt(ttc)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Observations */}
          {(d.observations||brand.defaultObservations)&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>OBSERVATIONS</div>
              <div style={{fontSize:10,color:"#374151",lineHeight:1.6}}>{d.observations||brand.defaultObservations}</div>
            </div>
          )}

          {/* Conditions */}
          {brand.paymentTerms&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>CONDITIONS</div>
              <div style={{fontSize:10,color:"#374151",lineHeight:1.6}}>{brand.paymentTerms}</div>
            </div>
          )}

          {/* RIB */}
          {brand.rib&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:navy,marginBottom:4}}>COORDONNÉES BANCAIRES</div>
              <div style={{fontSize:10,color:"#374151"}}>{brand.rib}</div>
              {brand.iban&&<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>IBAN : {brand.iban}</div>}
              {brand.bic&&<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>BIC : {brand.bic}</div>}
            </div>
          )}

          {/* Signature */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20,paddingTop:14,borderTop:"1px solid #d4d4d8"}}>
            <div>
              <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>SIGNATURE CLIENT · Bon pour accord</div>
              <div style={{height:60,borderBottom:"1px solid #9ca3af"}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:"#6b7280",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>DATE</div>
              <div style={{height:60,borderBottom:"1px solid #9ca3af"}}/>
            </div>
          </div>

          {/* Footer mentions + SIRET */}
          <div style={{marginTop:18,paddingTop:10,borderTop:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",gap:10,fontSize:8,color:"#9ca3af",lineHeight:1.5}}>
            <div style={{flex:1}}>
              {brand.mentionsLegales}
              {brand.siret && <div>SIRET {brand.siret}</div>}
            </div>
            <div style={{textAlign:"right"}}>Généré via Zenbat</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({stats,devis,clients,goDevis,setTab,brand}) {
  const ac = brand.color||"#22c55e";
  return (
    <div style={{padding:18}} className="fu">
      <div style={{marginBottom:18}}>
        <h1 style={{fontSize:21,fontWeight:700,color:"#0f172a"}}>{brand.companyName?"Bonjour, "+brand.companyName.split(" ")[0]:"Tableau de bord"}</h1>
        <p style={{color:"#94a3b8",fontSize:12,marginTop:2}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        {[{l:TX.clients,v:stats.clients,dot:"#3b82f6"},{l:TX.inProgress,v:stats.enCours,dot:"#f59e0b"},{l:TX.accepted,v:stats.acceptes,dot:ac},{l:TX.signedCA,v:fmt(stats.ca),dot:"#f97316"}].map(({l,v,dot})=>(
          <div key={l} style={{background:"white",borderRadius:14,padding:16,border:"1px solid #f1f5f9",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:dot,marginBottom:10}}/>
            <div style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>{v}</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f8fafc",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{TX.recentQuotes}</span>
          <button onClick={()=>setTab("devis")} style={{background:"none",border:"none",color:ac,fontSize:11,fontWeight:600,cursor:"pointer"}}>{TX.seeAll}</button>
        </div>
        {devis.slice(0,3).map(d=>{
          const cl=clients.find(c=>c.id===d.client_id);
          return (
            <div key={d.id} onClick={()=>goDevis(d.id)} style={{padding:"11px 16px",borderBottom:"1px solid #f8fafc",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.background="#fafafa"} onMouseOut={e=>e.currentTarget.style.background="white"}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{d.objet}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{cl?.raison_sociale||`${cl?.prenom||""} ${cl?.nom||""}`.trim()||"—"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{fmt(d.montant_ht)}</div>
                <div style={{marginTop:4}}><Badge s={d.statut}/></div>
              </div>
            </div>
          );
        })}
      </div>
      <div onClick={()=>setTab("agent")} style={{background:`linear-gradient(135deg,${ac}dd,${ac})`,borderRadius:14,padding:"16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,boxShadow:`0 4px 14px ${ac}44`}}>
        <div style={{width:38,height:38,borderRadius:10,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"white"}}>{I.spark}</div>
        <div><div style={{color:"white",fontWeight:700,fontSize:13}}>{TX.aiAgent}</div><div style={{color:"rgba(255,255,255,.75)",fontSize:11,marginTop:2}}>{TX.aiDesc}</div></div>
        <div style={{color:"rgba(255,255,255,.5)",marginLeft:"auto",fontSize:20}}>›</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  CLIENTS
// ══════════════════════════════════════════════════════════
function ClientsList({clients,goClient}) {
  return (
    <div style={{padding:18}} className="fu">
      <div style={{marginBottom:16}}><h1 style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>Clients</h1></div>
      <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden"}}>
        {clients.map(c=>(
          <div key={c.id} onClick={()=>goClient(c.id)} style={{padding:"13px 16px",borderBottom:"1px solid #f8fafc",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
            onMouseOver={e=>e.currentTarget.style.background="#fafafa"} onMouseOut={e=>e.currentTarget.style.background="white"}>
            <div style={{width:40,height:40,borderRadius:12,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#16a34a",fontSize:16,flexShrink:0}}>
              {(c.raison_sociale||c.prenom||"?")[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{c.raison_sociale||`${c.prenom} ${c.nom}`}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{c.email} · {c.ville}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientDetail({c,clientDevis,onBack,goDevis}) {
  return (
    <div style={{padding:18}} className="fu">
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#64748b",fontSize:13,marginBottom:14,cursor:"pointer"}}>{I.back} Retour</button>
      <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",padding:18,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#16a34a",fontSize:20}}>
            {(c.raison_sociale||c.prenom||"?")[0]}
          </div>
          <div><div style={{fontWeight:700,fontSize:16,color:"#0f172a"}}>{c.raison_sociale||`${c.prenom} ${c.nom}`}</div><div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{c.type} · {c.ville}</div></div>
        </div>
        {[["Email",c.email],["Ville",c.ville]].filter(([,v])=>v).map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:"1px solid #f8fafc"}}><span style={{fontSize:12,color:"#94a3b8"}}>{k}</span><span style={{fontSize:12,color:"#0f172a",fontWeight:500}}>{v}</span></div>
        ))}
      </div>
      <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f8fafc",fontWeight:600,fontSize:13,color:"#0f172a"}}>Devis ({clientDevis.length})</div>
        {clientDevis.map(d=>(
          <div key={d.id} onClick={()=>goDevis(d.id)} style={{padding:"12px 16px",borderBottom:"1px solid #f8fafc",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
            onMouseOver={e=>e.currentTarget.style.background="#fafafa"} onMouseOut={e=>e.currentTarget.style.background="white"}>
            <div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{d.objet}</div><div style={{fontSize:10,fontFamily:"monospace",color:"#94a3b8",marginTop:2}}>{d.numero}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700}}>{fmt(d.montant_ht)}</div><div style={{marginTop:4}}><Badge s={d.statut}/></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  DEVIS LIST
// ══════════════════════════════════════════════════════════
function DevisList({devis,clients,goDevis,setTab}) {
  const [filtre,setFiltre]=useState("tous");
  const filtered=filtre==="tous"?devis:devis.filter(d=>d.statut===filtre);
  return (
    <div style={{padding:18}} className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><h1 style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>Devis</h1><p style={{color:"#94a3b8",fontSize:11,marginTop:2}}>{devis.length} devis</p></div>
        <button onClick={()=>setTab("agent")} style={{background:"#22c55e",color:"white",border:"none",borderRadius:12,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>{I.spark} Via IA</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        {["tous","brouillon","en_signature","accepte","refuse"].map(s=>(
          <button key={s} onClick={()=>setFiltre(s)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:filtre===s?"#0f172a":"white",color:filtre===s?"white":"#64748b",boxShadow:filtre===s?"none":"0 1px 3px rgba(0,0,0,.06)"}}>
            {s==="tous"?"Tous":STATUT[s]?.label}
          </button>
        ))}
      </div>
      <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden"}}>
        {filtered.map(d=>{
          const cl=clients.find(c=>c.id===d.client_id);
          return (
            <div key={d.id} onClick={()=>goDevis(d.id)} style={{padding:"13px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.background="#fafafa"} onMouseOut={e=>e.currentTarget.style.background="white"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{d.objet}</div><div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{cl?.raison_sociale||`${cl?.prenom||""} ${cl?.nom||""}`.trim()||"—"}</div></div>
                <div style={{textAlign:"right",marginLeft:12,flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{fmt(d.montant_ht)}</div>
                  <div style={{marginTop:5}}><Badge s={d.statut}/></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  DEVIS DETAIL — avec bouton PDF live
// ══════════════════════════════════════════════════════════
function DevisDetail({d,cl,onBack,brand,onChange}) {
  const [showPDF, setShowPDF] = useState(false);
  const [sending, setSending] = useState(false);
  const [signUrl, setSignUrl] = useState(d.odoo_sign_url||null);
  const [log,     setLog]     = useState([]);
  const [showLog, setShowLog] = useState(false);
  const lignes = d.lignes?.length?d.lignes:DEMO_LIGNES;
  const ht  = lignes.filter(l=>l.type_ligne==="ouvrage").reduce((s,l)=>s+(l.quantite*(l.prix_unitaire||0)),0);
  const ac  = brand.color||"#22c55e";

  const addLog = msg => setLog(l=>[...l,{t:new Date().toLocaleTimeString("fr-FR"),msg}]);

  const sendOdoo = async () => {
    if(sending)return;
    setSending(true);setLog([]);setShowLog(true);
    addLog("Connexion à Odoo…");await new Promise(r=>setTimeout(r,700));
    addLog("✓ Connecté");addLog("Génération PDF…");await new Promise(r=>setTimeout(r,900));
    addLog(`✓ PDF généré : ${d.numero}.pdf`);addLog("Upload → Odoo (ir.attachment)…");
    await new Promise(r=>setTimeout(r,700));addLog("✓ Document uploadé");
    addLog(`Envoi demande à ${cl?.email||"client@email.fr"}…`);await new Promise(r=>setTimeout(r,800));
    const url=`https://odoo.monentreprise.com/sign/document/1042/abc123`;
    addLog("✓ Email envoyé");addLog("🎉 Devis en signature via Odoo Sign !");
    setSignUrl(url);onChange({...d,statut:"en_signature",odoo_sign_url:url});
    setSending(false);
  };

  const lotsResume=lignes.filter(l=>l.type_ligne==="ouvrage").reduce((a,l)=>{a[l.lot||"Divers"]=(a[l.lot||"Divers"]||0)+l.quantite*(l.prix_unitaire||0);return a;},{});

  return (
    <>
      {showPDF&&<PDFViewer d={d} cl={cl} brand={brand} onClose={()=>setShowPDF(false)}/>}

      <div style={{minHeight:"100%",background:"#f8fafc"}} className="fu">
        <div style={{background:"white",borderBottom:"1px solid #f1f5f9",padding:"13px 18px"}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#64748b",fontSize:13,marginBottom:12,cursor:"pointer"}}>{I.back} Retour</button>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",marginBottom:3}}>{d.numero}</div>
              <div style={{fontSize:17,fontWeight:700,color:"#0f172a",lineHeight:1.3}}>{d.objet}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4}}>{cl?.raison_sociale||`${cl?.prenom||""} ${cl?.nom||""}`.trim()||"—"} · {d.ville_chantier}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>{fmt(ht)}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:5}}>HT</div>
              <Badge s={d.statut}/>
            </div>
          </div>
        </div>

        <div style={{padding:18}}>
          {/* ⭐ Bouton PDF live — en premier, bien visible */}
          <button onClick={()=>setShowPDF(true)}
            style={{width:"100%",background:`linear-gradient(135deg,${ac}ee,${ac})`,color:"white",border:"none",borderRadius:16,padding:"16px",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",boxShadow:`0 6px 20px ${ac}44`,marginBottom:12}}>
            {I.pdf} Voir le PDF du devis
          </button>

          {/* Récap lots */}
          <div style={{background:"white",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #f8fafc",fontWeight:600,fontSize:13,color:"#0f172a"}}>Récapitulatif par lot</div>
            {Object.entries(lotsResume).map(([lot,mt])=>(
              <div key={lot} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:"#374151"}}>{lot}</span>
                <span style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>{fmt(mt)}</span>
              </div>
            ))}
            <div style={{padding:"12px 16px",background:"#f8fafc",display:"flex",justifyContent:"space-between"}}>
              <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>Total HT</span>
              <span style={{fontWeight:700,fontSize:14,color:ac}}>{fmt(ht)}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {!["accepte","refuse"].includes(d.statut)&&(
              <button onClick={sendOdoo} disabled={sending}
                style={{width:"100%",background:sending?"#9ca3af":"#714B67",color:"white",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer"}}>
                {sending?<><span style={{display:"inline-block",width:14,height:14,border:"2px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/> Envoi Odoo…</>:<>{I.odoo} Envoyer en signature Odoo Sign</>}
              </button>
            )}
            {signUrl&&(
              <div style={{background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#7c3aed",marginBottom:5,display:"flex",alignItems:"center",gap:5}}>{I.odoo} Lien de signature Odoo actif</div>
                <div style={{fontSize:10,color:"#6b21a8",fontFamily:"monospace",wordBreak:"break-all"}}>{signUrl}</div>
              </div>
            )}
            {d.statut==="en_signature"&&(
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>onChange({...d,statut:"accepte"})} style={{flex:1,background:"#ecfdf5",color:"#065f46",border:"1px solid #a7f3d0",borderRadius:12,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>✓ Accepté</button>
                <button onClick={()=>onChange({...d,statut:"refuse"})}  style={{flex:1,background:"#fef2f2",color:"#991b1b",border:"1px solid #fecaca",borderRadius:12,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>✗ Refusé</button>
              </div>
            )}
          </div>

          {/* Log Odoo */}
          {showLog&&log.length>0&&(
            <div style={{background:"#0f172a",borderRadius:14,padding:14,marginTop:14}}>
              <div style={{fontSize:10,fontWeight:600,color:"#475569",marginBottom:8,fontFamily:"monospace"}}>LOG ODOO SIGN</div>
              {log.map((l,i)=>(
                <div key={i} style={{fontFamily:"monospace",fontSize:11,color:l.msg.startsWith("✓")||l.msg.startsWith("🎉")?"#4ade80":l.msg.startsWith("❌")?"#f87171":"#94a3b8",marginBottom:3,display:"flex",gap:8}}>
                  <span style={{color:"#475569"}}>{l.t}</span><span>{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  AGENT IA — lignes qui pop une par une
// ══════════════════════════════════════════════════════════
function AgentIA({devis,setDevis,clients,plan,trialExpired,onPaywall,setTab,brand}) {
  const greeting = TX.agentGreeting;
  const [msgs,    setMsgs]   = useState([{role:"assistant",content:TX.agentGreeting}]);
  const [input,   setInput]  = useState("");
  const [loading, setLoading]= useState(false);
  const [lignes,  setLignes] = useState([]);
  const [objet,   setObjet]  = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const ac = brand.color||"#22c55e";
  const fontFamily = brand.fontStyle==="elegant"?"Playfair Display":brand.fontStyle==="tech"?"Space Grotesk":"DM Sans";

  useEffect(()=>{ chatRef.current?.scrollTo({top:chatRef.current.scrollHeight,behavior:"smooth"}); },[msgs,loading]);

  useEffect(()=>{
    if(!lignes.length) return;
    setVisibleCount(0);
    let i=0;
    const iv=setInterval(()=>{ i++; setVisibleCount(i); if(i>=lignes.length) clearInterval(iv); },110);
    return ()=>clearInterval(iv);
  },[lignes]);

  const ht = lignes.filter(l=>l.type_ligne==="ouvrage").reduce((s,l)=>s+(l.quantite*(l.prix_unitaire||0)),0);
  const tvaGroupsEditor = lignes.filter(l=>l.type_ligne==="ouvrage").reduce((a,l)=>{
    const r = Number(l.tva_rate ?? 20);
    a[r] = (a[r]||0) + (l.quantite||0)*(l.prix_unitaire||0);
    return a;
  },{});
  const tvaRowsEditor = Object.keys(tvaGroupsEditor).map(r=>Number(r)).sort((a,b)=>a-b).map(r=>({
    rate: r, base: tvaGroupsEditor[r], montant: tvaGroupsEditor[r]*(r/100)
  }));
  const tvaTotalEditor = tvaRowsEditor.reduce((s,r)=>s+r.montant,0);
  const ttcEditor = ht + tvaTotalEditor;

  const send = async () => {
    if(!input.trim()||loading) return;
    if(trialExpired){onPaywall();return;}
    const userMsg={role:"user",content:input};
    const newMsgs=[...msgs,userMsg];
    setMsgs(newMsgs); setInput(""); setLoading(true);
    try {
      const tradeNames = tradesLabels(brand.trades);
      const tradesBlock = tradeNames.length
        ? `\n\nSPÉCIALISATION DE L'ENTREPRISE — RÈGLE ABSOLUE :
L'entreprise est spécialisée UNIQUEMENT dans les métiers suivants : ${tradeNames.join(", ")}.
- Tu génères UNIQUEMENT des devis pour ces métiers.
- Si la demande sort de ce périmètre (ex : peinture demandée mais entreprise = plomberie), tu REFUSES poliment et tu ne renvoies AUCUNE balise <DEVIS>. Tu réponds en français : "Désolé, ${brand.companyName||"l'entreprise"} ne réalise pas ce type de travaux. Nous sommes spécialisés en : ${tradeNames.join(", ")}. Souhaitez-vous un devis dans l'un de ces domaines ?"
- Pour les demandes mixtes (ex : rénovation salle de bain alors que l'entreprise fait plomberie + carrelage), tu génères uniquement les lignes qui correspondent à tes métiers et tu signales en une phrase courte ce qui n'a pas été inclus.
- En cas de doute léger (ex : un travail à la frontière de l'un de tes métiers), accepte et précise-le brièvement.`
        : "";
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          system:`Tu es un assistant expert BTP France intégré dans l'application Zenbat.${tradesBlock}

LANGUE — RÈGLE ABSOLUE :
1. Tu comprends TOUTES les langues : français, arabe littéraire, darija marocaine, kabyle, espagnol, portugais, anglais, roumain, polonais, turc, wolof, bambara, tamoul, ourdou, hindi, chinois, russe, ukrainien, italien, allemand, etc. Tu comprends aussi les mélanges de langues et le français phonétique.
2. Tu réponds TOUJOURS en français professionnel, 100% du temps, SANS EXCEPTION, même si l'utilisateur écrit dans une autre langue. N'utilise JAMAIS un seul mot dans la langue d'origine de l'utilisateur.
3. Tu TRADUIS systématiquement en français toutes les prestations décrites, quel que soit la langue d'entrée. Exemples :
   - "zellige f l'7amam" (darija) → "Pose de zellige dans la salle de bain"
   - "tile the bathroom floor" (anglais) → "Pose de carrelage au sol de la salle de bain"
   - "pintar las paredes" (espagnol) → "Peinture des murs"
   - "دهان الجدران" (arabe) → "Peinture des murs"
4. Le JSON (objet, lots, désignations, unités) est TOUJOURS rédigé en français normé du bâtiment. Aucune trace de la langue d'origine ne doit apparaître. Utilise la terminologie technique française du BTP (ex : "cloison placo BA13", "chape de ravoirage", "enduit de finition").
5. Le message conversationnel (hors balises <DEVIS>) est lui aussi 100% en français.

TÂCHE : L'utilisateur décrit des travaux à devisser. TOUJOURS répondre avec un JSON entre <DEVIS></DEVIS> même si c'est une seule ligne.
Si l'utilisateur donne un prix unitaire explicite, utilise-le EXACTEMENT (quelle que soit la langue dans laquelle il l'a écrit).

Format strict : {"objet":"titre court en français","lignes":[
  {"type_ligne":"lot","designation":"NOM DU LOT EN FRANÇAIS"},
  {"type_ligne":"ouvrage","lot":"nom lot","designation":"description en français","unite":"m2|ml|u|m3|fg|ens","quantite":10,"prix_unitaire":25,"tva_rate":20}
]}

TVA : applique le taux correct par ouvrage selon la réglementation française :
- 5.5% : travaux d'amélioration de la qualité énergétique (isolation thermique, pompe à chaleur, chaudière à haute performance, fenêtres isolantes dans logement >2 ans).
- 10% : travaux d'entretien/rénovation/amélioration dans logement d'habitation achevé depuis plus de 2 ans (peinture, plomberie courante, carrelage, revêtements sols/murs, cuisine, salle de bain).
- 20% : neuf, gros œuvre, démolition/évacuation, logement <2 ans, locaux professionnels, fournitures livrées sans pose.
Mets "tva_rate":5.5, 10 ou 20 (nombre sans guillemets, sans %) pour CHAQUE ligne "ouvrage". En cas de doute, utilise 10.

Règles : prix réalistes BTP France 2025, groupe par lots, désignations professionnelles en français.
Si besoin de précision, pose UNE seule question courte EN FRANÇAIS, et génère quand même un JSON partiel.`,
          messages:newMsgs.map(m=>({role:m.role,content:m.content}))
        })
      });
      if(!res.ok) throw new Error("api");
      const data=await res.json();
      const raw=data.content?.[0]?.text||"";
      const match=raw.match(/<DEVIS>([\s\S]*?)<\/DEVIS>/);
      const txt=raw.replace(/<DEVIS>[\s\S]*?<\/DEVIS>/g,"").trim();
      if(match){
        try{
          const parsed=JSON.parse(match[1].trim());
          const newLignes=(parsed.lignes||[]).map(l=>({...l,id:uid()}));
          if(parsed.objet&&!objet) setObjet(parsed.objet);
          setLignes(prev=>{
            const existingDesigs=new Set(prev.map(l=>l.designation));
            const toAdd=newLignes.filter(l=>!existingDesigs.has(l.designation));
            return [...prev,...toAdd];
          });
        }catch(e){}
      }
      setMsgs(m=>[...m,{role:"assistant",content:txt||(match?TX.linesAdded:"Je n'ai pas compris, pouvez-vous reformuler ?")}]);
    }catch(e){
      // Erreur en langage simple selon le type
      const msg = !navigator.onLine ? TX.errNetwork : e.message==="api" ? TX.errApi : TX.errGeneral;
      setMsgs(m=>[...m,{role:"assistant",content:"❌ "+msg}]);
    }
    setLoading(false);
  };

  const deleteLigne = id => setLignes(l=>l.filter(x=>x.id!==id));

  const save = () => {
    const ht2=lignes.filter(l=>l.type_ligne==="ouvrage").reduce((s,l)=>s+(l.quantite*(l.prix_unitaire||0)),0);
    setDevis(ds=>[...ds,{id:uid(),numero:`DEV-2026-${String(devis.length+1).padStart(4,"0")}`,objet:objet||"Devis IA",client_id:"",ville_chantier:"",statut:"brouillon",montant_ht:ht2,date_emission:new Date().toISOString().split("T")[0],lignes,odoo_sign_url:null}]);
    setLignes([]); setObjet("");
    setMsgs([{role:"assistant",content:TX.quoteSaved}]);
    setTimeout(()=>setTab("devis"),2500);
  };

  const visibleLignes = lignes.slice(0,visibleCount);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#f8fafc"}}>
      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-14px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes rowPop{0%{opacity:0;transform:translateY(6px) scaleY(.85)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes totalCount{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* ═══ HAUT : PDF EN-TÊTE + LIGNES ═══════════════════ */}
      <div style={{flexShrink:0,background:"white",borderBottom:"2px solid #f1f5f9",maxHeight:"52%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* En-tête PDF avec branding */}
        <div style={{background:ac,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {brand.logo
              ? <img src={brand.logo} alt="" style={{height:32,maxWidth:100,objectFit:"contain"}}/>
              : <span style={{fontFamily,fontWeight:800,fontSize:15,color:"white"}}>{brand.companyName||"Votre entreprise"}</span>
            }
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily,color:"rgba(255,255,255,.6)",fontSize:9,letterSpacing:"1.5px",fontWeight:600}}>{TX.quoteInProgress.toUpperCase()}</div>
            <div style={{fontFamily,color:"white",fontWeight:800,fontSize:18,marginTop:2,animation:"totalCount .3s ease both"}}>
              {fmt(ht)}
              <span style={{fontSize:10,fontWeight:400,color:"rgba(255,255,255,.7)",marginLeft:4}}>HT</span>
            </div>
          </div>
        </div>

        {/* Bandeau objet */}
        {objet&&(
          <div style={{background:"#0f172a",padding:"6px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontFamily,color:"rgba(255,255,255,.9)",fontSize:12,fontWeight:600}}>{objet}</span>
            <span style={{color:"#64748b",fontSize:10}}>{lignes.filter(l=>l.type_ligne==="ouvrage").length} ligne{lignes.filter(l=>l.type_ligne==="ouvrage").length>1?"s":""}</span>
          </div>
        )}

        {/* Lignes du devis — scrollables */}
        <div style={{flex:1,overflowY:"auto",minHeight:0}}>
          {visibleLignes.length===0 ? (
            <div style={{padding:"20px 16px",textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:8}}>📋</div>
              <div style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>Les lignes du devis apparaîtront ici</div>
              <div style={{fontSize:11,color:"#cbd5e1",marginTop:4}}>Décrivez les travaux ci-dessous</div>
            </div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0,background:"white",zIndex:1}}>
                <tr style={{borderBottom:"1px solid #f1f5f9"}}>
                  <th style={{textAlign:"left",padding:"6px 14px",fontSize:9,fontWeight:600,color:"#94a3b8",letterSpacing:"1px"}}>DÉSIGNATION</th>
                  <th style={{textAlign:"right",padding:"6px 8px",fontSize:9,fontWeight:600,color:"#94a3b8",width:50}}>QTÉ</th>
                  <th style={{textAlign:"right",padding:"6px 8px",fontSize:9,fontWeight:600,color:"#94a3b8",width:65}}>P.U. HT</th>
                  <th style={{textAlign:"right",padding:"6px 14px",fontSize:9,fontWeight:600,color:"#94a3b8",width:75}}>TOTAL HT</th>
                  <th style={{width:28}}/>
                </tr>
              </thead>
              <tbody>
                {visibleLignes.map((l,idx)=>{
                  if(l.type_ligne==="lot") return (
                    <tr key={l.id} style={{animation:"slideIn .25s ease both",animationDelay:`${idx*0.05}s`}}>
                      <td colSpan={5} style={{background:ac+"18",padding:"7px 14px",borderBottom:"1px solid "+ac+"22"}}>
                        <span style={{fontFamily,fontSize:10,fontWeight:700,color:ac,textTransform:"uppercase",letterSpacing:"1px"}}>{l.designation}</span>
                      </td>
                    </tr>
                  );
                  const total=(l.quantite||0)*(l.prix_unitaire||0);
                  return (
                    <tr key={l.id} style={{borderBottom:"1px solid #f8fafc",animation:"rowPop .3s cubic-bezier(.34,1.3,.64,1) both",animationDelay:`${idx*0.06}s`}}>
                      <td style={{padding:"8px 14px"}}>
                        <div style={{fontSize:12,fontWeight:500,color:"#1e293b",fontFamily}}>{l.designation}</div>
                        <div style={{fontSize:10,color:"#94a3b8",marginTop:1,display:"flex",alignItems:"center",gap:6}}>
                          <span>{l.unite}</span>
                          <button
                            onClick={()=>{
                              const cycle = [20, 10, 5.5];
                              const cur = Number(l.tva_rate ?? 20);
                              const next = cycle[(cycle.indexOf(cur)+1) % cycle.length];
                              setLignes(prev=>prev.map(x=>x.id===l.id?{...x,tva_rate:next}:x));
                            }}
                            title="Cliquer pour changer le taux de TVA"
                            style={{background:"#eef2f7",color:"#475569",border:"none",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            TVA {(l.tva_rate ?? 20).toString().replace(".",",")}%
                          </button>
                        </div>
                      </td>
                      <td style={{padding:"8px",textAlign:"right",fontSize:12,color:"#374151",fontWeight:600}}>{l.quantite}</td>
                      <td style={{padding:"8px",textAlign:"right",fontSize:11,color:"#64748b"}}>{fmt(l.prix_unitaire)}</td>
                      <td style={{padding:"8px 14px",textAlign:"right",fontSize:12,fontWeight:700,color:"#0f172a"}}>{fmt(total)}</td>
                      <td style={{padding:"4px"}}>
                        <button onClick={()=>deleteLigne(l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#e2e8f0",fontSize:14,lineHeight:1,padding:"2px 4px"}}
                          onMouseOver={e=>e.target.style.color="#ef4444"} onMouseOut={e=>e.target.style.color="#e2e8f0"}>×</button>
                      </td>
                    </tr>
                  );
                })}
                {visibleCount < lignes.length && (
                  <tr><td colSpan={5} style={{padding:"8px 14px"}}>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:ac,animation:`bounce .8s ease ${i*150}ms infinite`}}/>)}
                      <span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>Ajout en cours…</span>
                    </div>
                  </td></tr>
                )}
              </tbody>
              {ht>0&&visibleCount>=lignes.length&&(
                <tfoot>
                  <tr style={{borderTop:`2px solid ${ac}`}}>
                    <td colSpan={3} style={{padding:"8px 14px",fontSize:12,fontWeight:700,color:"#0f172a",fontFamily}}>Total HT</td>
                    <td style={{padding:"8px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:ac,fontFamily,animation:"totalCount .4s ease both"}}>{fmt(ht)}</td>
                    <td/>
                  </tr>
                  {tvaRowsEditor.map(row=>(
                    <tr key={row.rate} style={{background:"#f8fafc"}}>
                      <td colSpan={3} style={{padding:"4px 14px",fontSize:11,color:"#64748b"}}>
                        TVA {row.rate.toString().replace(".",",")}% <span style={{color:"#cbd5e1",fontSize:10}}>(sur {fmt(row.base)})</span>
                      </td>
                      <td style={{padding:"4px 14px",textAlign:"right",fontSize:11,color:"#64748b"}}>{fmt(row.montant)}</td>
                      <td/>
                    </tr>
                  ))}
                  <tr style={{background:ac}}>
                    <td colSpan={3} style={{padding:"8px 14px",fontSize:13,fontWeight:800,color:"white",fontFamily}}>Total TTC</td>
                    <td style={{padding:"8px 14px",textAlign:"right",fontSize:15,fontWeight:800,color:"white",fontFamily}}>{fmt(ttcEditor)}</td>
                    <td/>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Bouton Enregistrer le devis */}
        {lignes.length>0&&visibleCount>=lignes.length&&(
          <div style={{padding:"10px 14px",borderTop:"1px solid #f1f5f9",display:"flex",gap:8,flexShrink:0,animation:"fadeUp .3s ease both"}}>
            <button onClick={()=>{setLignes([]);setObjet("");}} style={{flex:1,background:"none",border:"1px solid #e2e8f0",borderRadius:10,padding:"9px",fontSize:12,color:"#64748b",cursor:"pointer",fontWeight:500}}>{TX.clearQuote}</button>
            <button onClick={save} style={{flex:2,background:ac,color:"white",border:"none",borderRadius:10,padding:"9px",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:`0 3px 10px ${ac}55`}}>
              {TX.saveQuote}
            </button>
          </div>
        )}
      </div>

      {/* ═══ BAS : CHAT ══════════════════════════════════════ */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>

        {/* Messages */}
        <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:6}}>
              {m.role==="assistant"&&(
                <div style={{width:24,height:24,borderRadius:"50%",background:ac+"22",border:`1px solid ${ac}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:ac,fontSize:12}}>✦</div>
              )}
              <div style={{maxWidth:"82%",borderRadius:m.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px",padding:"9px 13px",fontSize:12,lineHeight:1.55,
                background:m.role==="user"?"#0f172a":"white",color:m.role==="user"?"white":"#1e293b",
                boxShadow:m.role==="assistant"?"0 1px 4px rgba(0,0,0,.07)":"none",
                border:m.role==="assistant"?"1px solid #f1f5f9":"none"}}>
                {m.content.split("\n").map((l,j)=><span key={j}>{l.replace(/\*([^*]+)\*/g,"$1")}{j<m.content.split("\n").length-1&&<br/>}</span>)}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:ac+"22",border:`1px solid ${ac}44`,display:"flex",alignItems:"center",justifyContent:"center",color:ac,fontSize:12}}>✦</div>
              <div style={{background:"white",border:"1px solid #f1f5f9",borderRadius:"16px 16px 16px 3px",padding:"10px 14px",display:"flex",gap:4,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
                {[0,140,280].map(d=><div key={d} style={{width:6,height:6,borderRadius:"50%",background:ac,animation:`bounce 1s ease ${d}ms infinite`}}/>)}
              </div>
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div style={{padding:"10px 14px 12px",background:"white",borderTop:"1px solid #f1f5f9",flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-end",background:"#f8fafc",borderRadius:14,border:`1.5px solid ${input.trim()?ac:"#e2e8f0"}`,padding:"8px 10px",transition:"border-color .2s"}}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder={TX.inputPlaceholder}
              rows={1} style={{flex:1,background:"none",border:"none",outline:"none",fontSize:12,color:"#1e293b",resize:"none",fontFamily:"inherit",lineHeight:1.5,maxHeight:80,overflow:"auto"}}/>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button title="Micro" style={{width:30,height:30,borderRadius:9,background:"#f1f5f9",border:"none",display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",cursor:"pointer",fontSize:13}}>🎙</button>
              <button onClick={send} disabled={!input.trim()||loading}
                style={{width:30,height:30,borderRadius:9,background:input.trim()&&!loading?ac:"#d1fae5",border:"none",display:"flex",alignItems:"center",justifyContent:"center",color:"white",cursor:"pointer",transition:"background .2s"}}>
                {I.send}
              </button>
            </div>
          </div>
          <div style={{textAlign:"center",fontSize:9,color:"#cbd5e1",marginTop:6}}>{TX.inputHint}</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
function AuthScreen({onEnter}) {
  const [mode,setMode]=useState("login");
  const [siret,setSiret]=useState("");
  const [company,setCompany]=useState(null);
  const [searching,setSearching]=useState(false);

  const searchPappers=async()=>{
    if(siret.length<9)return;
    setSearching(true);
    await new Promise(r=>setTimeout(r,1200));
    setCompany({nom:"Maçonnerie Dupont SAS",ville:"Le Havre",siret,activite:"Construction de maisons individuelles"});
    setSearching(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{marginBottom:14,fontSize:38,fontWeight:800,letterSpacing:"-1px"}}><span style={{color:"#22c55e"}}>Zen</span><span style={{color:"white"}}>bat</span></div>
          <p style={{color:"#64748b",fontSize:12}}>Devis BTP · Simple · Rapide · Professionnel</p>
        </div>
        <div style={{background:"white",borderRadius:24,padding:24,boxShadow:"0 24px 48px rgba(0,0,0,.3)"}}>
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:20}}>
            {[["login","Se connecter"],["signup","Créer un compte"]].map(([m,l])=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px",borderRadius:10,border:"none",fontSize:12,fontWeight:600,background:mode===m?"white":"transparent",color:mode===m?"#0f172a":"#94a3b8",cursor:"pointer",boxShadow:mode===m?"0 1px 3px rgba(0,0,0,.1)":"none"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="signup"&&(
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:6}}>SIRET — Identification Pappers</label>
                <div style={{display:"flex",gap:8}}>
                  <input value={siret} onChange={e=>setSiret(e.target.value.replace(/\D/g,""))} placeholder="14 chiffres" maxLength={14}
                    style={{flex:1,border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 12px",fontSize:13,outline:"none"}}/>
                  <button onClick={searchPappers} disabled={siret.length<9||searching}
                    style={{background:siret.length>=9?"#22c55e":"#d1fae5",color:"white",border:"none",borderRadius:12,padding:"10px 12px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",minWidth:68}}>
                    {searching?<span style={{display:"inline-block",width:13,height:13,border:"2px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>:"Chercher"}
                  </button>
                </div>
                {company&&(
                  <div style={{marginTop:10,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"10px 14px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#15803d"}}>{company.nom}</div>
                    <div style={{fontSize:11,color:"#16a34a",marginTop:2}}>{company.activite} · {company.ville}</div>
                  </div>
                )}
              </div>
            )}
            <input type="email" placeholder="Email" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
            <input type="password" placeholder="Mot de passe" onKeyDown={e=>e.key==="Enter"&&onEnter(company?.nom||null)} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
            <button onClick={()=>onEnter(company?.nom||null)} style={{width:"100%",background:"#22c55e",color:"white",border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,marginTop:4,cursor:"pointer"}}>
              {mode==="login"?"Se connecter →":"Créer mon compte gratuit →"}
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0"}}>
            <hr style={{flex:1,border:"none",borderTop:"1px solid #f1f5f9"}}/><span style={{color:"#cbd5e1",fontSize:11}}>ou</span><hr style={{flex:1,border:"none",borderTop:"1px solid #f1f5f9"}}/>
          </div>
          <button onClick={()=>onEnter(null)} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:12,padding:"11px",fontSize:12,fontWeight:600,background:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#374151",cursor:"pointer"}}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continuer avec Google
          </button>
          {mode==="signup"&&<p style={{textAlign:"center",fontSize:11,color:"#94a3b8",marginTop:14}}>2 devis IA gratuits/mois · puis 15€/mois</p>}
        </div>
      </div>
    </div>
  );
}

function PaywallScreen({daysLeft=0,onBack}) {
  const expired = daysLeft <= 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const subscribe = async () => {
    setError(null); setLoading(true);
    try { await startCheckout(); }
    catch (e) { setError(e.message); setLoading(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{marginBottom:20,fontSize:32,fontWeight:800}}><span style={{color:"#22c55e"}}>Zen</span><span style={{color:"white"}}>bat</span></div>
        <h2 style={{color:"white",fontSize:20,fontWeight:700,marginBottom:8}}>{expired?"Période d'essai terminée":`Encore ${daysLeft} jour${daysLeft>1?"s":""} d'essai`}</h2>
        <p style={{color:"#64748b",fontSize:13,marginBottom:24,lineHeight:1.6}}>{expired?"Votre essai gratuit de 30 jours est terminé. Passez à Zenbat Pro pour continuer à utiliser l'Agent IA, le PDF brandé et l'envoi en signature.":"Profitez de toutes les fonctionnalités gratuitement pendant votre essai. Passez à Pro à tout moment."}</p>
        <div style={{background:"white",borderRadius:24,padding:22,textAlign:"left",marginBottom:14,boxShadow:"0 24px 48px rgba(0,0,0,.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div><div style={{fontWeight:700,fontSize:16,color:"#0f172a"}}>Zenbat Pro</div><div style={{color:"#94a3b8",fontSize:11,marginTop:2}}>Pour artisans et entreprises BTP</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:700,color:"#22c55e"}}>19€</div><div style={{color:"#94a3b8",fontSize:11}}>/mois TTC</div></div>
          </div>
          {["Agent IA illimité (voix + texte)","PDF brandé avec votre logo","Envoi Odoo Sign intégré","Identification SIRET via Pappers","Signature électronique eIDAS","Annulation à tout moment"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#22c55e"}}>{I.check}</div>
              <span style={{fontSize:13,color:"#374151"}}>{f}</span>
            </div>
          ))}
          <button onClick={subscribe} disabled={loading} style={{width:"100%",background:"#22c55e",color:"white",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:700,marginTop:14,cursor:loading?"wait":"pointer",opacity:loading?0.7:1}}>
            {loading ? "Redirection…" : "S'abonner — 19€/mois"}
          </button>
          {error && <div style={{background:"#fef2f2",color:"#991b1b",padding:10,borderRadius:10,fontSize:12,marginTop:10}}>{error}</div>}
        </div>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#475569",fontSize:12,cursor:"pointer"}}>← Retour</button>
      </div>
    </div>
  );
}
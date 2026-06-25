import { useState, useRef, useEffect } from "react"
import { SR_LANGS, MIC_LANG_KEY, pickInitialLang } from "../lib/agentIA/speech.js"
import { logError } from "../lib/logger.js"

// Encapsule l'API Web Speech (reconnaissance vocale) pour l'Agent IA.
//
// Gère trois pièges de la Web Speech API à l'usage quotidien :
//  - Chrome desktop coupe spontanément la session après ~10 s de silence
//    (onend déclenché sans que l'utilisateur n'ait rien fait).
//  - iOS Safari ignore `continuous: true` et stoppe après chaque phrase.
//  → Auto-restart silencieux dans onend tant que l'utilisateur n'a pas
//    explicitement appuyé sur stop, plafonné à 3 tentatives sans résultat.
//
//  - L'événement de démarrage réel arrive après .start() (jusqu'à 1-2 s
//    sur mobile). Si on bascule listening=true tout de suite, l'utilisateur
//    parle dans le vide. On attend onstart pour le passer à true et on
//    expose un état `connecting` intermédiaire.
//
//  - Sur iOS PWA, SpeechRecognition échoue parfois silencieusement à la
//    première utilisation. On pré-obtient la permission micro via
//    getUserMedia (une fois par session) avant de démarrer.
//
// Diagnostic d'erreur ciblé : not-allowed, network, audio-capture,
// service-not-allowed (HTTPS), language-not-supported — chaque code a un
// message actionnable au lieu d'un "Erreur" générique.
export function useSpeechRecognition({ input, setInput }) {
  const SRClass = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const micSupported = !!SRClass

  const [listening,  setListening]  = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [micLang,    setMicLang]    = useState(() => pickInitialLang())
  const [langMenu,   setLangMenu]   = useState(false)
  const [micError,   setMicError]   = useState(null)

  const recRef               = useRef(null)
  const accumRef             = useRef("")
  // Dernière valeur qu'on a poussée dans setInput. Si input courant ≠ cette
  // valeur, c'est que l'utilisateur a tapé manuellement pendant l'écoute —
  // on resynchronise accumRef pour ne pas écraser sa saisie au prochain
  // résultat (cf. useEffect plus bas).
  const lastSetInputRef      = useRef("")
  const userStoppedRef       = useRef(false)
  const restartCountRef      = useRef(0)
  const gotResultRef         = useRef(false)
  const permissionPrimedRef  = useRef(false)
  // audio-capture sur iOS est le plus souvent transitoire (micro brièvement
  // occupé, flux getUserMedia pas encore libéré). On autorise UN redémarrage
  // silencieux avant d'afficher une erreur. Remis à 0 à chaque nouvelle
  // session d'écoute et dès qu'on capte un résultat.
  const audioCaptureRetryRef = useRef(0)

  useEffect(() => () => {
    const rec = recRef.current
    if (rec) {
      rec.onstart = rec.onresult = rec.onend = rec.onerror = null
      try { rec.stop() } catch {}
    }
  }, [])

  useEffect(() => {
    if (!listening) return
    if (input !== lastSetInputRef.current) {
      accumRef.current = input && !input.endsWith(" ") ? input + " " : input
    }
  }, [input, listening])

  const setError = (msg) => {
    setMicError(msg)
    setListening(false)
    setConnecting(false)
    userStoppedRef.current = true
  }

  // Edge desktop : l'API SpeechRecognition est exposée mais s'appuie sur
  // un service cloud Microsoft notoirement instable (renvoie souvent
  // `error: 'network'` même avec une connexion fonctionnelle, à cause du
  // tracking prevention ou d'un proxy d'entreprise). On le détecte pour
  // adapter le message de diagnostic.
  const isEdgeDesktop = () => typeof navigator !== "undefined"
    && /Edg\//i.test(navigator.userAgent)
    && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)

  const explainError = (code) => {
    switch (code) {
      case "not-allowed":
        return "Microphone bloqué. Autorisez-le via l'icône à gauche de la barre d'adresse."
      case "service-not-allowed":
        return typeof window !== "undefined" && !window.isSecureContext
          ? "La dictée vocale exige une connexion sécurisée (HTTPS)."
          : "Reconnaissance vocale indisponible sur ce navigateur ou ce réseau."
      case "audio-capture":
        return "Micro indisponible : il est peut-être utilisé par une autre application ou un appel. Fermez-la, puis réessayez."
      case "network":
        return isEdgeDesktop()
          ? "Le service vocal de Edge est instable sur ordinateur. Essayez Chrome (la dictée y est nettement plus fiable)."
          : "Service de reconnaissance vocale injoignable. Vérifiez votre connexion ou essayez un autre navigateur."
      case "language-not-supported":
        return "Langue non supportée par votre navigateur. Essayez Français."
      case "no-speech":
      case "aborted":
        return null
      default:
        return "Problème de reconnaissance vocale. Réessayez."
    }
  }

  const _attachAndStart = () => {
    const rec = new SRClass()
    rec.lang = micLang
    rec.continuous     = true
    rec.interimResults = true
    rec.onstart = () => {
      setConnecting(false)
      setListening(true)
      gotResultRef.current = false
    }
    rec.onresult = (e) => {
      gotResultRef.current = true
      restartCountRef.current = 0
      audioCaptureRetryRef.current = 0
      let interim = "", final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + " "
        else interim += t
      }
      if (final) accumRef.current += final
      const next = accumRef.current + interim
      lastSetInputRef.current = next
      setInput(next)
    }
    rec.onerror = (ev) => {
      // audio-capture : tentative de récupération silencieuse (1 fois). On
      // neutralise l'auto-restart de onend (via userStopped + onend=null) pour
      // ne pas avoir deux redémarrages concurrents, puis on relance après un
      // court délai laissant iOS libérer/réacquérir la session audio.
      if (ev.error === "audio-capture" && audioCaptureRetryRef.current < 1) {
        audioCaptureRetryRef.current += 1
        userStoppedRef.current = true
        try { if (recRef.current) recRef.current.onend = null } catch {}
        setConnecting(true)
        setTimeout(() => {
          userStoppedRef.current = false
          try { _attachAndStart() } catch { setError(explainError("audio-capture")) }
        }, 500)
        return
      }
      const msg = explainError(ev.error)
      if (msg) {
        setError(msg)
        // Trace en app_logs pour l'admin : les codes silencieux (no-speech,
        // aborted) restent ignorés ; on ne loggue que les erreurs qui ont
        // un message utilisateur. Permet de corréler "le micro marche pas"
        // avec network / not-allowed / audio-capture chez l'utilisateur.
        logError(`speech recognition: ${ev.error || "unknown"}`, null, {
          area: "speech-recognition",
          code: ev.error,
          lang: micLang,
          edge_desktop: isEdgeDesktop(),
        })
      }
      else {
        // no-speech / aborted : on ne montre pas d'erreur, mais on laisse
        // onend décider d'un éventuel auto-restart.
      }
    }
    rec.onend = () => {
      if (userStoppedRef.current) {
        setListening(false); setConnecting(false)
        return
      }
      // Si plus de 3 redémarrages successifs sans le moindre résultat,
      // on abandonne (évite la boucle infinie si le moteur refuse).
      if (!gotResultRef.current && restartCountRef.current >= 3) {
        setListening(false); setConnecting(false)
        return
      }
      restartCountRef.current += 1
      try {
        _attachAndStart()
      } catch {
        setListening(false); setConnecting(false)
      }
    }
    rec.start()
    recRef.current = rec
  }

  // Pré-obtention de la permission micro la première fois (iOS PWA en
  // particulier : SpeechRecognition échoue parfois silencieusement sans).
  const primePermission = async () => {
    if (permissionPrimedRef.current) return true
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      permissionPrimedRef.current = true
      return true
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      permissionPrimedRef.current = true
      return true
    } catch {
      setError(explainError("not-allowed"))
      return false
    }
  }

  const stopListening = () => {
    userStoppedRef.current = true
    try { recRef.current?.stop() } catch {}
    setListening(false); setConnecting(false)
  }

  const startListening = async () => {
    if (!SRClass) {
      setError("Reconnaissance vocale indisponible. Essayez Chrome, Edge, ou Safari récent (≥ 14.1).")
      return
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("La dictée vocale exige une connexion sécurisée (HTTPS).")
      return
    }
    setMicError(null)
    setConnecting(true)
    const initial = input && !input.endsWith(" ") ? input + " " : input
    accumRef.current = initial
    lastSetInputRef.current = initial
    userStoppedRef.current = false
    restartCountRef.current = 0
    gotResultRef.current    = false
    audioCaptureRetryRef.current = 0

    const ok = await primePermission()
    if (!ok) return
    try {
      _attachAndStart()
    } catch {
      setError("Impossible de démarrer la reconnaissance vocale.")
    }
  }

  const toggleMic = () => (listening || connecting ? stopListening() : startListening())

  // Stop "fort" appelé quand l'utilisateur envoie son message : détache
  // onresult/onend pour ignorer un tick final en vol et purger le buffer.
  const stopAndClear = () => {
    userStoppedRef.current = true
    try {
      const rec = recRef.current
      if (rec) { rec.onresult = null; rec.onend = null; rec.stop() }
    } catch {}
    setListening(false); setConnecting(false)
    accumRef.current = ""
    lastSetInputRef.current = ""
  }

  const pickLang = (code) => {
    setMicLang(code)
    try { localStorage.setItem(MIC_LANG_KEY, code) } catch {}
    setLangMenu(false)
    if (listening || connecting) { stopListening(); setTimeout(() => startListening(), 200) }
  }

  const currentLang = SR_LANGS.find(l => l.code === micLang) || SR_LANGS[0]

  return {
    listening, connecting, micSupported, micError, currentLang,
    langMenu, setLangMenu,
    toggleMic, pickLang, stopAndClear,
    langs: SR_LANGS,
  }
}

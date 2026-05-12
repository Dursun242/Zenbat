import { useState, useRef, useEffect } from "react"
import { SR_LANGS, MIC_LANG_KEY, pickInitialLang } from "../lib/agentIA/speech.js"

// Encapsule l'API Web Speech (reconnaissance vocale) pour l'Agent IA.
// `input` / `setInput` sont les controllés du champ texte : le hook les
// utilise pour préserver le texte déjà saisi avant d'ajouter la transcription.
export function useSpeechRecognition({ input, setInput }) {
  const SRClass = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const micSupported = !!SRClass

  const [listening, setListening] = useState(false)
  const [micLang,   setMicLang]   = useState(() => pickInitialLang())
  const [langMenu,  setLangMenu]  = useState(false)
  const [micError,  setMicError]  = useState(null)

  const recRef   = useRef(null)
  const accumRef = useRef("")

  useEffect(() => () => {
    const rec = recRef.current
    if (rec) {
      rec.onresult = null
      rec.onend    = null
      rec.onerror  = null
      try { rec.stop() } catch {}
    }
  }, [])

  const stopListening = () => {
    try { recRef.current?.stop() } catch {}
    setListening(false)
  }

  const startListening = () => {
    if (!SRClass) { setMicError("La reconnaissance vocale n'est pas disponible sur ce navigateur."); return }
    setMicError(null)
    accumRef.current = input && !input.endsWith(" ") ? input + " " : input
    const rec = new SRClass()
    rec.lang = micLang
    rec.continuous     = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interim = "", final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + " "
        else interim += t
      }
      if (final) accumRef.current += final
      setInput(accumRef.current + interim)
    }
    rec.onerror = (ev) => {
      setListening(false)
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setMicError("Microphone refusé. Autorisez-le dans les réglages du navigateur.")
      } else if (ev.error === "no-speech") {
        setMicError(null)
      } else {
        setMicError("Problème de reconnaissance vocale. Réessayez.")
      }
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  const toggleMic = () => (listening ? stopListening() : startListening())

  // Stop "fort" appelé quand l'utilisateur envoie son message : on détache
  // onresult pour ignorer un tick final en vol et on purge le buffer pour
  // éviter qu'un futur démarrage ré-injecte l'ancien texte.
  const stopAndClear = () => {
    try {
      const rec = recRef.current
      if (rec) { rec.onresult = null; rec.stop() }
    } catch {}
    setListening(false)
    accumRef.current = ""
  }

  const pickLang = (code) => {
    setMicLang(code)
    try { localStorage.setItem(MIC_LANG_KEY, code) } catch {}
    setLangMenu(false)
    if (listening) { stopListening(); setTimeout(startListening, 120) }
  }

  const currentLang = SR_LANGS.find(l => l.code === micLang) || SR_LANGS[0]

  return {
    listening, micSupported, micError, currentLang,
    langMenu, setLangMenu,
    toggleMic, pickLang, stopAndClear,
    langs: SR_LANGS,
  }
}

import { Component } from 'react'
import { logError } from '../lib/logger.js'
import { isChunkLoadError, tryReloadOnce } from '../lib/chunkRecovery.js'

export default class ErrorBoundary extends Component {
  state = { error: null, recovering: false }

  static getDerivedStateFromError(error) {
    // Cas typique après un redéploiement Vercel : un React.lazy() référence un
    // chunk dont le hash a changé. On rend un loader sobre pendant que le
    // reload one-shot (lancé dans componentDidCatch) prend effet.
    if (isChunkLoadError(error)) return { error, recovering: true }
    return { error, recovering: false }
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      // Pas de log (bruit légitime) : on tente un reload silencieux.
      // Si on est en cooldown (reload déjà tenté il y a moins de 30s), on
      // bascule sur l'écran d'erreur classique pour ne pas boucler.
      const reloaded = tryReloadOnce()
      if (!reloaded) this.setState({ recovering: false })
      return
    }
    console.error('[Zenbat] Crash React:', error, info?.componentStack)
    logError(
      error.message || 'React crash',
      error.stack || null,
      { type: 'react.componentDidCatch', componentStack: info?.componentStack?.slice(0, 1000) }
    )
  }

  render() {
    if (this.state.recovering) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FAF7F2', color: '#6B6358', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
          Mise à jour de l'application…
        </div>
      )
    }
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#FAF7F2', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1612', marginBottom: 10 }}>
            Une erreur inattendue s'est produite
          </h2>
          <p style={{ fontSize: 14, color: '#6B6358', marginBottom: 28, maxWidth: 380 }}>
            L'application a rencontré un problème. Vos données sont en sécurité.
          </p>
          <button
            onClick={() => { this.setState({ error: null, recovering: false }); window.location.reload(); }}
            style={{ padding: '12px 24px', borderRadius: 10, border: 0, background: '#1A1612', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Recharger l'application
          </button>
          <details style={{ marginTop: 24, maxWidth: 480, textAlign: 'left' }}>
            <summary style={{ fontSize: 12, color: '#9A8E82', cursor: 'pointer' }}>Détails techniques</summary>
            <pre style={{ marginTop: 8, fontSize: 11, color: '#6B6358', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F0EBE3', padding: 12, borderRadius: 8 }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

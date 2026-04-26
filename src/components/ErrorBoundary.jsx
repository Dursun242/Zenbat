import { Component } from 'react'
import { logError } from '../lib/logger.js'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Zenbat] Crash React:', error, info?.componentStack)
    logError(
      error.message || 'React crash',
      error.stack || null,
      { type: 'react.componentDidCatch', componentStack: info?.componentStack?.slice(0, 1000) }
    )
  }

  render() {
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
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
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

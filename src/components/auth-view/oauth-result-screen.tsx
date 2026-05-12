// CrOAuthResultScreen — terminal landing page for the /oauth-result
// redirect after a credential-bootstrap OAuth ceremony (currently
// GitHub). Renders a brief status, then redirects back to the main
// app. The credential is already stored in the vault by the time we
// land here and the brain's elicit has been resolved server-side.

import { useEffect } from 'react'


export function OAuthResultScreen() {
  const params = new URLSearchParams(window.location.search)
  const provider = params.get('provider') ?? 'oauth'
  const status = params.get('status') ?? 'unknown'
  const reason = params.get('reason') ?? ''

  useEffect(() => {
    // Auto-redirect back to the main app after a brief delay so the
    // operator sees the result. The brain has already resumed
    // (server resolved the elicit at /oauth/{provider}/callback time).
    const t = setTimeout(() => {
      window.location.href = '/'
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  const isOk = status === 'ok'
  const accent = isOk ? '#16A34A' : '#DC2626'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cream)',
        fontFamily: 'Inter, sans-serif',
        padding: 24,
      }}
    >
      <div
        className="cr-bevel"
        style={{
          padding: '24px 28px',
          background: 'var(--cream-hi)',
          borderColor: accent,
          borderWidth: 2,
          maxWidth: 420,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          className="cr-kicker"
          style={{ fontSize: 9, color: accent, letterSpacing: 0.7 }}
        >
          {provider.toUpperCase()} · {status.toUpperCase()}
        </div>
        <h1
          className="cr-mono"
          style={{ fontSize: 16, margin: 0 }}
        >
          {isOk
            ? 'Credential stored.'
            : 'Auth did not complete.'}
        </h1>
        <p
          className="cr-mono"
          style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}
        >
          {isOk
            ? 'Returning to your task — the agent will retry automatically.'
            : reason
              ? `Reason: ${reason}. You can fall back to pasting a token.`
              : 'You can fall back to pasting a token.'}
        </p>
        <p
          className="cr-mono"
          style={{ fontSize: 9, color: 'var(--muted)', margin: 0 }}
        >
          (redirecting…)
        </p>
      </div>
    </div>
  )
}

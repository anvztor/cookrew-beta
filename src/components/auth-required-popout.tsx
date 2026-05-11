// CrAuthRequiredPopout — typed card for `op: "auth_required"` elicits.
//
// The brain hit an auth-shaped failure (401/403/MCP-32603) on an upstream
// API and emitted a structured delegate to HumanHand:
//   delegate({to:"human", input:{op:"auth_required", host, env_var_name, reason}})
//
// HumanHand emits an `elicit` event carrying those fields; cookrew-web's
// invocation-stream parser surfaces them on `PendingElicit`. This card
// renders an auth-specific UI (paste box) rather than the generic
// schema-driven form in CrInvocationElicitPopout.
//
// On submit:
//   POST /api/v1/credentials/paste {host, env_var_name, token, invocation_id}
// The route auto-resolves the elicit by posting an accept ResultEnvelope
// to the same invocation, so the brain receives `accept` and retries the
// failed op — at which point SandboxHand merges the just-stored credential
// into env, the upstream call succeeds, and the task continues.

import { useEffect, useState } from 'react'

import type { PendingElicit } from '../lib/api/invocation-stream'


const KREWHUB =
  (import.meta.env.VITE_KREWHUB_URL as string | undefined) ??
  'http://localhost:8420'


interface CrAuthRequiredPopoutProps {
  item: PendingElicit | null
  onClose?: () => void
  onResolved?: () => void
}

const GITHUB_HOSTS = new Set([
  'api.github.com', 'github.com', 'codeload.github.com',
])

function isGitHubHost(host: string | null | undefined): boolean {
  if (!host) return false
  const h = host.toLowerCase()
  return GITHUB_HOSTS.has(h) || h.endsWith('.github.com')
}

export function CrAuthRequiredPopout({
  item, onClose, onResolved,
}: CrAuthRequiredPopoutProps) {
  const [token, setToken] = useState('')
  const [envVarName, setEnvVarName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [oauthLaunching, setOauthLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setToken('')
    setError(null)
    // Pre-fill env var name from the structured payload (e.g. GITHUB_TOKEN)
    setEnvVarName(item?.envVarName ?? '')
  }, [item?.invocationId, item?.envVarName])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose?.()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, submitting])

  if (!item || item.op !== 'auth_required') return null

  const host = item.host ?? '(unknown host)'
  const reason = item.reason ?? ''
  const supportsOAuth = isGitHubHost(host)

  const canSubmit = token.trim().length > 0 && envVarName.trim().length > 0

  const handleOAuthLaunch = async () => {
    if (!item) return
    setOauthLaunching(true)
    setError(null)
    try {
      const r = await fetch(
        `${KREWHUB}/api/v1/oauth/github/start?invocation_id=${encodeURIComponent(item.invocationId)}`,
        { credentials: 'include' },
      )
      if (!r.ok) {
        const body = await r.text()
        throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`)
      }
      const data = await r.json() as { authorize_url: string }
      // Open in same window — the OAuth callback redirects back to
      // cookrew-web after consent, and PendingElicit clears via the
      // server's submit_result. Popup mode is finickier across browsers.
      window.location.href = data.authorize_url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOauthLaunching(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`${KREWHUB}/api/v1/credentials/paste`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.toLowerCase(),
          env_var_name: envVarName.trim(),
          token: token,
          invocation_id: item.invocationId,
        }),
      })
      if (!r.ok) {
        const body = await r.text()
        throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`)
      }
      onResolved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const accent = '#DC2626'
  const bg = '#FEF2F2'

  return (
    <div
      className="cr"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(20,17,10,0.55)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={submitting ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cr-bevel"
        style={{
          width: 'min(480px, 94vw)',
          margin: 12,
          background: 'var(--cream-hi)',
          borderColor: accent,
          borderWidth: 2,
          boxShadow: `6px 6px 0 ${accent}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: `2px solid ${accent}`,
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cr-led red" />
            <span className="cr-kicker" style={{ fontSize: 8, color: accent, letterSpacing: 0.7 }}>
              AUTH NEEDED · {host.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="cr-bevel"
            style={{
              padding: '2px 8px',
              background: 'var(--cream-hi)',
              fontFamily: 'Silkscreen,monospace',
              fontSize: 9,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            ESC ✕
          </button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reason && (
            <div className="cr-mono" style={{ fontSize: 11, lineHeight: 1.4 }}>
              {reason}
            </div>
          )}
          <div className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            The brain hit an authentication failure. {supportsOAuth
              ? <>Connect via OAuth (recommended) or paste a token below.</>
              : <>Paste a credential for <strong style={{ color: 'var(--ink)' }}>{host}</strong> below.</>
            } It's encrypted, stored in your account's vault, and injected as
            an env var the next time the brain runs an op. The brain never
            sees it directly.
          </div>

          {supportsOAuth && (
            <button
              onClick={handleOAuthLaunch}
              disabled={oauthLaunching || submitting}
              className="cr-bevel"
              style={{
                padding: '10px 14px',
                background: '#24292e',
                color: 'white',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 12,
                cursor: oauthLaunching ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {oauthLaunching ? 'OPENING GITHUB…' : 'CONNECT VIA GITHUB'}
            </button>
          )}

          {supportsOAuth && (
            <div
              className="cr-mono"
              style={{
                fontSize: 9,
                color: 'var(--muted)',
                textAlign: 'center',
                padding: '4px 0',
              }}
            >
              — or paste a token —
            </div>
          )}

          <label
            className="cr-mono"
            style={{ fontSize: 9, color: 'var(--muted)' }}
          >
            ENV VAR NAME
            <input
              type="text"
              value={envVarName}
              onChange={(e) => setEnvVarName(e.target.value)}
              placeholder="GITHUB_TOKEN"
              disabled={submitting}
              className="cr-bevel"
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            />
          </label>

          <label
            className="cr-mono"
            style={{ fontSize: 9, color: 'var(--muted)' }}
          >
            TOKEN
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              disabled={submitting}
              autoFocus
              className="cr-bevel"
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            />
          </label>

          {error && (
            <div
              className="cr-mono"
              style={{ fontSize: 10, color: accent }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={submitting}
              className="cr-bevel"
              style={{
                padding: '6px 12px',
                background: 'var(--cream-hi)',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 10,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="cr-bevel"
              style={{
                padding: '6px 12px',
                background: canSubmit && !submitting ? accent : '#9CA3AF',
                color: 'white',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 10,
                cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'STORING…' : 'STORE & CONTINUE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

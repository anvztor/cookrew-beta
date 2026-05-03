import { useEffect, useState } from 'react'
import { consumeReturnTo, exchangeCode, me } from '../../lib/auth/auth-client'
import { useAuth } from '../../lib/auth/useAuth'

interface Diag {
  step: string
  detail?: string
}

export function CallbackScreen() {
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<Diag[]>([])
  const log = (step: string, detail?: string) => setDiag((d) => [...d, { step, detail }])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    const finishAuthed = async (path = '/') => {
      log('finishAuthed', `redirecting to ${path}`)
      window.history.replaceState({}, '', path)
      window.location.reload()
    }

    void (async () => {
      // Path A — /me first. If the cookie was set first-party at
      // /auth/password/login this should already work without exchangeCode.
      log('me-1', 'checking existing session')
      const acc1 = await me().catch((e) => { log('me-1 error', String(e)); return null })
      if (acc1) {
        log('me-1 ok', acc1.account_id)
        const returnTo = consumeReturnTo()
        await refresh()
        await finishAuthed(returnTo || '/')
        return
      }
      log('me-1', 'no session yet')

      if (!code || !state) {
        log('error', 'missing code/state and no session')
        setError('missing_params')
        return
      }

      // Path B — try exchangeCode (cross-origin Set-Cookie may be dropped
      // by Chrome 3rd-party blocking, but PKCE verification still happens).
      log('exchange', 'POST /oauth/token')
      try {
        await exchangeCode(code, state)
        log('exchange', 'ok')
      } catch (e: unknown) {
        log('exchange error', e instanceof Error ? e.message : String(e))
      }

      // Path C — /me again, in case exchangeCode set the cookie.
      log('me-2', 'rechecking session')
      const acc2 = await me().catch((e) => { log('me-2 error', String(e)); return null })
      if (acc2) {
        log('me-2 ok', acc2.account_id)
        const returnTo = consumeReturnTo()
        await refresh()
        await finishAuthed(returnTo || '/')
        return
      }

      setError('login_session_lost')
    })()
  }, [refresh])

  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'Inter,sans-serif',
        background: 'var(--cream)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>
          {error ? `Login failed: ${error}` : 'Signing in…'}
        </div>
        <div style={{
          fontFamily: 'JetBrains Mono,ui-monospace,monospace',
          fontSize: 11,
          background: 'var(--cream-hi)',
          border: '2px solid var(--line)',
          padding: 12,
        }}>
          {diag.map((d, i) => (
            <div key={i}>
              <strong>{d.step}</strong>{d.detail ? `: ${d.detail}` : ''}
            </div>
          ))}
        </div>
        {error && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <a href="/">← back to start</a>
          </div>
        )}
      </div>
    </div>
  )
}

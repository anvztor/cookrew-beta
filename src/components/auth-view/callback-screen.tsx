import { useEffect, useState } from 'react'
import { exchangeCode } from '../../lib/auth/auth-client'
import { useAuth } from '../../lib/auth/useAuth'

export function CallbackScreen() {
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setError('missing_params')
      return
    }
    void (async () => {
      try {
        await exchangeCode(code, state)
        await refresh()
        window.history.replaceState({}, '', '/')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
      }
    })()
  }, [refresh])

  return (
    <div
      style={{
        padding: 32,
        fontFamily: 'Inter,sans-serif',
        background: 'var(--cream)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {error ? `Login failed: ${error}` : 'Signing in…'}
    </div>
  )
}

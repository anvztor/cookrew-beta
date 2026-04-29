import { useState } from 'react'
import { CrButton, CrInput } from '../atoms/atoms'

const KREWHUB = (import.meta.env.VITE_KREWHUB_URL as string | undefined) ?? 'http://localhost:8420'

interface Props {
  bundleId: string
  onPaired: (runtimeId: string) => void
  onClose: () => void
}

export function HireAgentModal({ bundleId, onPaired, onClose }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`${KREWHUB}/bundles/${bundleId}/pair-agent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code.trim().toUpperCase() }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({} as { detail?: string }))
        setError(body.detail ?? `pair_failed_${r.status}`)
        return
      }
      const body = (await r.json()) as { runtime_id: string }
      onPaired(body.runtime_id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--cream-hi)',
          border: '2px solid var(--line)',
          padding: 24,
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
          fontFamily: 'Inter,sans-serif',
          boxShadow: '4px 4px 0 var(--line)',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>HIRE AGENT</h2>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>
          Run <code>krewcli login</code> on the agent&apos;s machine, then enter the code shown.
        </p>
        <CrInput
          value={code}
          onChange={(e) => setCode((e.target as HTMLInputElement).value)}
          placeholder="ABCD-1234"
          style={{ width: '100%', marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: 'crimson', fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}
        <div
          style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
        >
          <CrButton onClick={onClose}>CANCEL</CrButton>
          <CrButton
            variant="primary"
            onClick={() => void submit()}
            disabled={busy || !code}
          >
            PAIR
          </CrButton>
        </div>
      </div>
    </div>
  )
}

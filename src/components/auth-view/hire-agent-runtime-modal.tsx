// HireAgentRuntimeModal — phosphor-terminal pairing UI wired to the
// real krewhub backend. Implements the inverted RFC 8628 flow:
//
//   1. user runs `krewcli login` on their machine → krewcli prints a
//      USER_CODE (e.g. "ABCD-1234") fetched from krewauth.
//   2. user pastes USER_CODE here.
//   3. cookrew-beta POSTs /bundles/{bundle_id}/pair-agent with the code;
//      krewhub relays the approval to krewauth via service token, then
//      creates an `agent_runtimes` row owned by the caller account.
//   4. cookrew-beta refetches the runtime list and the roster updates.
//
// The legacy mock "runtime scan" animation is gone — the only thing
// the user sees is a phosphor terminal that streams real backend
// responses (PAIRED, RT_ID, STATUS).

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CrButton, CrChip } from '../atoms/atoms'
import {
  listRuntimes,
  pairAgent,
  type Runtime,
} from '../../lib/api/krewhub-client'
import type { Variant } from '../party-sidebar'

interface Props {
  open: boolean
  onClose: () => void
  accountId: string
  /** Called with the freshly-fetched roster of runtimes after a pair succeeds. */
  onPaired: (runtimes: Runtime[]) => void
  variant?: Variant
}

type Phase = 'input' | 'pairing' | 'success' | 'error'

interface LogLine {
  text: string
  tone?: 'dim' | 'hi' | 'err'
}

export function HireAgentRuntimeModal({
  open,
  onClose,
  accountId,
  onPaired,
  variant = 'desktop',
}: Props) {
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [log, setLog] = useState<LogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setCode('')
    setPhase('input')
    setLog([
      { text: '▸ KREW-PAIR · awaiting daemon code from `krewcli login`', tone: 'hi' },
      { text: `  account: ${accountId.slice(0, 14)}…`, tone: 'dim' },
    ])
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open, accountId])

  const append = (line: LogLine) => setLog((l) => [...l, line])

  const submit = async () => {
    const userCode = code.trim().toUpperCase()
    if (!userCode) return
    setPhase('pairing')
    setError(null)
    append({ text: `▸ POST /agents/pair  (code=${userCode})`, tone: 'dim' })

    try {
      const result = await pairAgent(userCode)
      append({ text: `[+] PAIRED · ${result.runtime_id}`, tone: 'hi' })
      append({ text: '▸ GET /agents/runtimes …', tone: 'dim' })

      const runtimes = await listRuntimes(accountId)
      append({ text: `[+] ROSTER · ${runtimes.length} runtime(s) online`, tone: 'hi' })
      setPhase('success')

      // Brief beat so the user can read the success line, then commit.
      setTimeout(() => {
        onPaired(runtimes)
        onClose()
      }, 900)
    } catch (e) {
      const err = e as { code?: string; message?: string; status?: number }
      const detail = err.code ?? err.message ?? `pair_failed_${err.status ?? '???'}`
      append({ text: `[!] ${detail}`, tone: 'err' })
      setError(detail)
      setPhase('error')
    }
  }

  if (!open) return null
  const isMobile = variant === 'mobile'
  const busy = phase === 'pairing'
  const done = phase === 'success'

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    background: 'rgba(20,17,10,0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? 12 : 24,
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="cr cr-bevel"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          background: 'var(--cream-hi)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 4px 0 var(--line)',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '2px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--amber-soft)',
          }}
        >
          <span className="cr-display" style={{ fontSize: 12 }}>
            HIRE AGENT
          </span>
          <CrChip tone="phos" style={{ fontSize: 7 }}>
            DAEMON PAIRING
          </CrChip>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              border: '2px solid var(--line)',
              background: 'var(--cream-hi)',
              width: 24,
              height: 24,
              cursor: 'pointer',
              fontFamily: 'Silkscreen,monospace',
              fontSize: 12,
              padding: 0,
              boxShadow: '2px 2px 0 var(--line)',
            }}
          >
            ×
          </button>
        </div>

        <div
          className="cr-phos cr-crt"
          style={{
            margin: 12,
            padding: '10px 12px',
            fontFamily: 'VT323,monospace',
            fontSize: 14,
            minHeight: 160,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {log.map((ln, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <span
                className={
                  ln.tone === 'err'
                    ? ''
                    : ln.tone === 'hi'
                      ? 'cr-phos-hi'
                      : 'cr-phos-dim'
                }
                style={{
                  color:
                    ln.tone === 'err' ? 'var(--rose)' : undefined,
                  fontFamily:
                    ln.tone === 'hi' ? 'Silkscreen,monospace' : undefined,
                  fontSize: ln.tone === 'hi' ? 10 : undefined,
                }}
              >
                {ln.text}
              </span>
            </div>
          ))}
          {busy && (
            <div className="cr-phos-hi" style={{ marginTop: 4 }}>
              ▸ pairing…{' '}
              <span style={{ animation: 'cr-blink 0.7s step-end infinite' }}>▮</span>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '0 14px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label className="cr-kicker" style={{ fontSize: 8 }}>
            DAEMON CODE
          </label>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
            placeholder="ABCD-1234"
            disabled={busy || done}
            className="cr-input"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 16,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          />
          <div className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            Run <code>krewcli login</code> on the daemon&apos;s machine to get a
            code. The agent will appear in your party once paired.
          </div>
          {error && phase === 'error' && (
            <div className="cr-mono" style={{ fontSize: 11, color: 'var(--rose)' }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: '2px solid var(--line)',
            padding: 10,
            display: 'flex',
            gap: 8,
          }}
        >
          <CrButton variant="ghost" size="sm" onClick={onClose}>
            CANCEL
          </CrButton>
          <span style={{ flex: 1 }} />
          <CrButton
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={busy || done || !code.trim()}
          >
            {done ? 'PAIRED ✓' : busy ? 'PAIRING…' : 'PAIR ▶'}
          </CrButton>
        </div>
      </div>
    </div>
  )
}

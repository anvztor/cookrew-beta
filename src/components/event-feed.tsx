// CrEventFeed — phosphor-CRT log of REAL backend events.
//
// Subscribes to `GET /api/v1/recipes/{recipe_id}/stream` (SSE). Every line
// you see in the feed corresponds to a watch-service event from krewhub —
// no frontend narration, no in-process bus, no design-time mocks.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRecipeStream, type RecipeEvent } from '../lib/api/recipe-stream'
import type { Variant } from './party-sidebar'

interface CrEventFeedProps {
  variant?: Variant
  onClose?: () => void
  /** Recipe whose live event stream feeds this panel. */
  recipeId?: string
}

export function CrEventFeed({ variant = 'desktop', onClose, recipeId }: CrEventFeedProps) {
  const allEvents = useRecipeStream(recipeId)
  const [filter, setFilter] = useState<string>('ALL')
  const isMobile = variant === 'mobile'

  const events = useMemo<readonly RecipeEvent[]>(
    () => (filter === 'ALL' ? allEvents : allEvents.filter((e) => e.src === filter)),
    [allEvents, filter],
  )

  // Filter chips — derived from the live event sources, with the
  // canonical scopes always present so the row doesn't pop in.
  const sources = useMemo(() => {
    const base = ['ALL', 'BUNDLE', 'TASK', 'AGENT', 'SANDBOX', 'DIGEST']
    const seen = new Set(base)
    allEvents.forEach((e) => {
      if (!seen.has(e.src)) {
        base.push(e.src)
        seen.add(e.src)
      }
    })
    return base
  }, [allEvents])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [allEvents.length])

  const btnStyle: CSSProperties = {
    background: 'transparent',
    border: '1.5px solid var(--phos-dim)',
    color: 'var(--phos)',
    padding: '3px 7px',
    fontSize: 9,
    fontFamily: 'Silkscreen, monospace',
    fontWeight: 700,
    cursor: 'pointer',
    textShadow: '0 0 3px rgba(233,185,73,.7)',
    letterSpacing: 0.6,
  }

  return (
    <div
      className={`cr cr-phos ${isMobile ? '' : 'cr-crt'}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'VT323, monospace',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1.5px solid var(--phos-dim)',
          background: 'rgba(233,185,73,0.04)',
        }}
      >
        <span
          className="cr-phos-hi"
          style={{
            fontFamily: 'Silkscreen, monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          EVENT FEED
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--phos-dim)',
          }}
        >
          {events.length} TRACED · recipe {recipeId ? recipeId.slice(0, 14) : '—'}
        </span>
        {onClose && (
          <button onClick={onClose} style={btnStyle}>
            ×
          </button>
        )}
      </div>
      <div
        className="cr-noscrollbar"
        style={{
          display: 'flex',
          gap: 4,
          padding: 8,
          overflowX: 'auto',
          borderBottom: '1.5px solid var(--phos-dim)',
        }}
      >
        {sources.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              ...btnStyle,
              padding: '3px 8px',
              background: filter === s ? 'var(--phos)' : 'transparent',
              color: filter === s ? 'var(--phos-bg)' : 'var(--phos)',
              textShadow: filter === s ? 'none' : btnStyle.textShadow,
              flexShrink: 0,
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className="cr-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', fontSize: 14, lineHeight: 1.4 }}
      >
        {events.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 0',
              color: 'var(--phos-dim)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
            }}
          >
            <div>// SSE channel · open · idle</div>
            <div>// awaiting backend events for {recipeId ?? 'this recipe'}</div>
            <div>// hire an agent or ship a quest</div>
          </div>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            style={{ display: 'flex', gap: 6, padding: '2px 0', alignItems: 'flex-start' }}
          >
            <span
              className="cr-phos-dim"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, flexShrink: 0 }}
            >
              {e.t}
            </span>
            <span
              className="cr-phos-hi"
              style={{
                fontFamily: 'Silkscreen, monospace',
                fontSize: 9,
                flexShrink: 0,
                paddingTop: 1,
              }}
            >
              [{e.src}]
            </span>
            <span
              className="cr-phos-dim"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              {e.kind}
            </span>
            <span
              style={{
                flex: 1,
                color:
                  e.kind === 'sse.error'
                    ? 'var(--rose)'
                    : e.kind.endsWith('.completed') || e.kind.endsWith('.cooked')
                      ? 'var(--phos-glow)'
                      : 'var(--phos)',
              }}
            >
              {e.msg}
            </span>
          </div>
        ))}
        <div className="cr-phos-hi" style={{ marginTop: 4 }}>
          {'>'} <span style={{ animation: 'cr-blink 0.7s step-end infinite' }}>▮</span>
        </div>
      </div>
    </div>
  )
}

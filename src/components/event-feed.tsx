// CrEventFeed — phosphor "Pip-Boy" log of every system + agent action.
// Subscribes to the in-process event bus (emitEvent/useEvents) and to
// the krewhub SSE stream when a live taskId is provided.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEvents, emitEvent, type FeedEvent } from '../lib/event-bus'
import { streamTask } from '../lib/api/krewhub-client'
import type { Variant } from './party-sidebar'

interface CrEventFeedProps {
  variant?: Variant
  onClose?: () => void
  taskId?: string
}

export function CrEventFeed({ variant = 'desktop', onClose, taskId }: CrEventFeedProps) {
  const allEvents = useEvents()
  const [filter, setFilter] = useState<string>('ALL')
  const isMobile = variant === 'mobile'

  // When a live SSE task id is supplied, fan-in real backend events to the bus.
  useEffect(() => {
    if (!taskId) return
    const es = streamTask(taskId)
    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          kind?: string
          payload?: Record<string, unknown>
        }
        const kind = data.kind ?? 'event'
        const payloadStr =
          data.payload && typeof data.payload === 'object'
            ? JSON.stringify(data.payload).slice(0, 120)
            : ''
        emitEvent({
          src: 'TASK',
          kind:
            kind === 'task.completed'
              ? 'done'
              : kind === 'sandbox.attached'
                ? 'milestone'
                : 'info',
          msg: `${kind} ${payloadStr}`.trim(),
        })
      } catch {
        // ignore malformed event lines
      }
    }
    es.addEventListener('message', onMessage)
    return () => {
      es.removeEventListener('message', onMessage)
      es.close()
    }
  }, [taskId])

  const events = useMemo<readonly FeedEvent[]>(
    () => (filter === 'ALL' ? allEvents : allEvents.filter((e) => e.src === filter)),
    [allEvents, filter],
  )

  // Always keep ALL + the canonical sources visible so filter chips don't pop in.
  const sources = useMemo(() => {
    const base = ['ALL', 'SYS', 'SCOUT', 'GATEKEEPER', 'BREWER', 'PATCHER']
    const seen = new Set(base)
    allEvents.forEach((e) => {
      if (!seen.has(e.src)) {
        base.push(e.src)
        seen.add(e.src)
      }
    })
    return base
  }, [allEvents])

  // Auto-scroll to newest line on every new event.
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
          {events.length} TRACED
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
            <div>// awaiting events …</div>
            <div>// SSE channel · open · idle</div>
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
              style={{
                flex: 1,
                color:
                  e.kind === 'block' || e.kind === 'warn'
                    ? 'var(--rose)'
                    : e.kind === 'done' || e.kind === 'milestone'
                      ? 'var(--phos-glow)'
                      : e.kind === 'think'
                        ? 'var(--phos-dim)'
                        : e.kind === 'tool' || e.kind === 'code'
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

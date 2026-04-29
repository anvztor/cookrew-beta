import { useEffect, useMemo, useState } from 'react'
import { CR_EVENTS } from '../data/roster'
import type { Variant } from './party-sidebar'
import { streamTask } from '../lib/api/krewhub-client'

interface CrEventFeedProps {
  variant?: Variant
  onClose?: () => void
  // Auth track A2: when set, the feed subscribes to /tasks/{id}/stream
  // and prepends live events to the legacy mock CR_EVENTS list.
  taskId?: string
}

interface LiveEvent {
  t: string
  src: string
  msg: string
  kind?: 'block' | 'done' | 'info'
}

export function CrEventFeed({ variant = 'desktop', onClose, taskId }: CrEventFeedProps) {
  const [filter, setFilter] = useState<string>('ALL')
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const isMobile = variant === 'mobile'

  useEffect(() => {
    if (!taskId) return
    const es = streamTask(taskId)
    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          kind?: string
          payload?: Record<string, unknown>
        }
        const ts = new Date().toLocaleTimeString().slice(0, 8)
        const kind = data.kind ?? 'event'
        const summary =
          (data.payload && typeof data.payload === 'object'
            ? JSON.stringify(data.payload).slice(0, 120)
            : '') || ''
        setLiveEvents((cur) => [
          ...cur,
          {
            t: ts,
            src: 'TASK',
            msg: `${kind} ${summary}`.trim(),
            kind: kind === 'task.completed' ? 'done' : 'info',
          },
        ])
      } catch {
        // ignore malformed events
      }
    }
    es.addEventListener('message', onMessage)
    return () => {
      es.removeEventListener('message', onMessage)
      es.close()
    }
  }, [taskId])

  const allEvents: LiveEvent[] = useMemo(
    () =>
      [...liveEvents, ...CR_EVENTS] as LiveEvent[],
    [liveEvents],
  )
  const events = useMemo(
    () => (filter === 'ALL' ? allEvents : allEvents.filter((e) => e.src === filter)),
    [allEvents, filter],
  )
  const sources = useMemo(
    () => ['ALL', ...new Set(allEvents.map((e) => e.src))],
    [allEvents],
  )

  const btnStyle: React.CSSProperties = {
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
        className="cr-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', fontSize: 14, lineHeight: 1.4 }}
      >
        {events.map((e, i) => (
          <div
            key={i}
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
                  e.kind === 'block'
                    ? 'var(--rose)'
                    : e.kind === 'done'
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

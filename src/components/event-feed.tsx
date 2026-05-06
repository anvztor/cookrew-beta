// CrEventFeed — phosphor-CRT log of REAL backend events, tabbed by agent.
//
// Subscribes to `GET /api/v1/recipes/{recipe_id}/stream` (SSE) via
// useRecipeStream. Tabs are agent identities (e.g. `echo@krew`) plus
// ALL and SYSTEM. When the user clicks an assigned task on the
// mission board, MobileApp passes `focusTaskId` + `focusAgentId`
// here: the feed pre-selects that agent's tab and filters to events
// for that single task — including all the rich `event.added` rows
// (thinking / tool_use / tool_result / agent_reply / milestone / …).

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useRecipeStream, type RecipeEvent } from '../lib/api/recipe-stream'
import type { Variant } from './party-sidebar'

interface CrEventFeedProps {
  variant?: Variant
  onClose?: () => void
  /** Recipe whose live event stream feeds this panel. */
  recipeId?: string
  /** Pre-select this agent's tab on open (set by task-click). */
  focusAgentId?: string
  /** Filter events to a single task on open (set by task-click). */
  focusTaskId?: string
}

const ALL = 'ALL'
const SYSTEM = 'SYSTEM'

export function CrEventFeed({
  variant = 'desktop',
  onClose,
  recipeId,
  focusAgentId,
  focusTaskId,
}: CrEventFeedProps) {
  const allEvents = useRecipeStream(recipeId)
  const isMobile = variant === 'mobile'

  // The active tab is `filter` — defaults to whatever focusAgentId says
  // on mount/change. Manual tab clicks override.
  const [filter, setFilter] = useState<string>(focusAgentId ?? ALL)
  // Keep a per-mount ref of the most-recent focusAgentId we've seen
  // so a brand-new focus from MobileApp re-runs setFilter without
  // clobbering subsequent manual clicks.
  const lastFocusAgent = useRef<string | undefined>(focusAgentId)
  useEffect(() => {
    if (focusAgentId && focusAgentId !== lastFocusAgent.current) {
      setFilter(focusAgentId)
      lastFocusAgent.current = focusAgentId
    }
  }, [focusAgentId])

  // Tabs: ALL, SYSTEM, then every distinct agent the stream has seen.
  const tabs = useMemo(() => {
    const set = new Set<string>()
    allEvents.forEach((e) => set.add(e.agent))
    set.delete(SYSTEM)
    const agentTabs = Array.from(set).sort()
    const list = [ALL, SYSTEM, ...agentTabs]
    // If a focused agent isn't in the stream yet (we haven't seen any
    // events from them), still surface the tab so the user sees it
    // pre-selected rather than the chip silently disappearing.
    if (focusAgentId && !list.includes(focusAgentId)) list.push(focusAgentId)
    return list
  }, [allEvents, focusAgentId])

  // Filter pipeline: agent tab + (optional) per-task focus.
  const events = useMemo<readonly RecipeEvent[]>(() => {
    let out: readonly RecipeEvent[] = allEvents
    if (focusTaskId) {
      out = out.filter((e) => e.taskId === focusTaskId)
    }
    if (filter !== ALL) {
      out = out.filter((e) => e.agent === filter)
    }
    return out
  }, [allEvents, filter, focusTaskId])

  // Auto-scroll to newest line on every push.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length])

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

      {focusTaskId && (
        <div
          style={{
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1.5px solid var(--phos-dim)',
            background: 'rgba(217,119,6,0.10)',
          }}
        >
          <span
            className="cr-phos-hi"
            style={{
              fontFamily: 'Silkscreen, monospace',
              fontSize: 9,
              letterSpacing: 0.6,
            }}
          >
            ▸ FOCUS
          </span>
          <span
            style={{
              flex: 1,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--phos-glow)',
            }}
          >
            task {focusTaskId.slice(0, 18)}…
          </span>
        </div>
      )}

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
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              ...btnStyle,
              padding: '3px 8px',
              background: filter === t ? 'var(--phos)' : 'transparent',
              color: filter === t ? 'var(--phos-bg)' : 'var(--phos)',
              textShadow: filter === t ? 'none' : btnStyle.textShadow,
              flexShrink: 0,
            }}
          >
            {t}
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
            {focusTaskId ? (
              <div>// awaiting events for this task…</div>
            ) : filter !== ALL ? (
              <div>// no events from {filter} yet</div>
            ) : (
              <div>// awaiting backend events for this recipe</div>
            )}
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
                maxWidth: 110,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              [{e.agent}]
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

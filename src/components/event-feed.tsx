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
import {
  appendTaskFollowup,
  getTaskEvents,
  type TaskHistoryEvent,
} from '../lib/api/krewhub-client'
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

  // ── Task history (focused mode) ──────────────────────────────
  // When the operator focuses a task, fetch the full event tape so the
  // feed renders the entire conversation (thinking / tool_use /
  // tool_result / agent_reply / human_followup), not just events from
  // the moment of subscription. Re-fetches when live events for this
  // task land — keeps history in sync as the agent keeps working.
  const [history, setHistory] = useState<TaskHistoryEvent[]>([])
  const liveTaskEventCount = useMemo(
    () => (focusTaskId ? allEvents.filter((e) => e.taskId === focusTaskId).length : 0),
    [allEvents, focusTaskId],
  )
  useEffect(() => {
    let cancelled = false
    if (!focusTaskId) {
      setHistory([])
      return
    }
    void (async () => {
      try {
        const { events: rows } = await getTaskEvents(focusTaskId, { limit: 400 })
        if (!cancelled) setHistory(rows)
      } catch {
        if (!cancelled) setHistory([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [focusTaskId, liveTaskEventCount])

  // Auto-scroll to newest line on every push.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length, history.length])

  // Reply composer state — visible only when a focused task is set.
  // Threads onto the existing task's tape via POST /tasks/{id}/followup.
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyNote, setReplyNote] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Focus the composer whenever a new task comes into focus so the
  // operator can just start typing.
  useEffect(() => {
    if (focusTaskId) inputRef.current?.focus()
  }, [focusTaskId])
  const submitReply = async () => {
    const text = draft.trim()
    if (!text || !focusTaskId || sending) return
    setSending(true)
    setReplyNote(null)
    try {
      const { status_flipped } = await appendTaskFollowup(focusTaskId, text)
      setDraft('')
      setReplyNote({
        kind: 'ok',
        msg: status_flipped ? 'sent · task reopened' : 'sent',
      })
    } catch (e) {
      setReplyNote({ kind: 'err', msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setSending(false)
    }
  }

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
        {(() => {
          // When focused: render the full task tape (mapped to the
          // same RecipeEvent shape) so we get one consistent renderer.
          // Otherwise: render live recipe events as today.
          const rows: readonly RecipeEvent[] = focusTaskId
            ? history.map(historyToRow)
            : events
          if (rows.length === 0) {
            return (
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
                  <div>// loading task tape…</div>
                ) : filter !== ALL ? (
                  <div>// no events from {filter} yet</div>
                ) : (
                  <div>// awaiting backend events for this recipe</div>
                )}
              </div>
            )
          }
          return rows.map((e) => (
            <div
              key={e.id}
              style={{ display: 'flex', gap: 6, padding: '2px 0', alignItems: 'flex-start' }}
            >
              <span
                className="cr-phos-dim"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  flexShrink: 0,
                }}
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
                  color: e.agent === 'human' ? 'var(--cyan, #38BDF8)' : undefined,
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
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily:
                    e.kind === 'tool_result' || e.kind === 'tool_use'
                      ? 'JetBrains Mono, monospace'
                      : undefined,
                  fontSize: e.kind === 'tool_result' ? 12 : undefined,
                  fontStyle: e.kind === 'thinking' ? 'italic' : undefined,
                  color:
                    e.kind === 'sse.error'
                      ? 'var(--rose)'
                      : e.agent === 'human'
                        ? 'var(--cyan, #38BDF8)'
                        : e.kind === 'agent_reply' || e.kind === 'milestone'
                          ? 'var(--phos-glow)'
                          : e.kind === 'thinking'
                            ? 'var(--phos-dim)'
                            : e.kind.endsWith('.completed') || e.kind.endsWith('.cooked')
                              ? 'var(--phos-glow)'
                              : 'var(--phos)',
                }}
              >
                {e.msg}
              </span>
            </div>
          ))
        })()}
        {focusTaskId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitReply()
            }}
            onClick={() => inputRef.current?.focus()}
            className="cr-phos-hi"
            style={{
              marginTop: 4,
              position: 'relative',
              display: 'flex',
              alignItems: 'baseline',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              lineHeight: 1.2,
              cursor: 'text',
              minHeight: 18,
            }}
          >
            {/* Visible layer: prompt + typed text + trailing ▮ cursor.
                The text mirrors the input's value so the cursor always
                trails the last character. */}
            <span style={{ whiteSpace: 'pre' }}>{'> '}</span>
            <span
              aria-hidden
              style={{
                whiteSpace: 'pre',
                color: 'var(--phos-hi)',
              }}
            >
              {draft}
            </span>
            <span
              aria-hidden
              style={{
                animation: sending ? undefined : 'cr-blink 0.7s step-end infinite',
                pointerEvents: 'none',
                color: 'var(--phos-hi)',
                opacity: sending ? 0.4 : 1,
              }}
            >
              ▮
            </span>
            {/* Invisible input absorbs key events. Native caret hidden
                so only the trailing ▮ is visible. */}
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
              spellCheck={false}
              autoComplete="off"
              aria-label="reply to task"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                color: 'transparent',
                caretColor: 'transparent',
                padding: 0,
                margin: 0,
              }}
            />
          </form>
        ) : (
          <div className="cr-phos-hi" style={{ marginTop: 4 }}>
            {'>'} <span style={{ animation: 'cr-blink 0.7s step-end infinite' }}>▮</span>
          </div>
        )}
        {replyNote && (
          <div
            style={{
              marginTop: 4,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: replyNote.kind === 'err' ? 'var(--rose)' : 'var(--phos-glow)',
            }}
          >
            // {replyNote.msg}
          </div>
        )}
      </div>
    </div>
  )
}

// Convert TaskHistoryEvent → RecipeEvent so the existing row renderer
// shows the full task tape. `msg` carries the unfiltered body text so
// the row's flex:1 column wraps it across multiple lines — no
// truncation. `agent` discriminates human follow-ups so the existing
// tab logic surfaces them.
function fmtClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function historyToRow(row: TaskHistoryEvent): RecipeEvent {
  const inner = row.payload || {}
  const text =
    (typeof inner.text === 'string' && (inner.text as string)) ||
    (typeof inner.output === 'string' && (inner.output as string)) ||
    (typeof inner.content === 'string' && (inner.content as string)) ||
    row.body ||
    ''
  // Human follow-ups ride the events.type CHECK constraint as
  // `agent_reply` + `actor_type=human` (no migration needed). The
  // raw `agent_reply` label would mislead operators reading the feed
  // — surface them as `human_followup` so the dialog is clear.
  const isHumanFollowup =
    row.actor_type === 'human' &&
    (row.type === 'agent_reply' ||
      (typeof inner.kind === 'string' && inner.kind === 'human_followup'))
  return {
    id: row.id,
    t: fmtClock(row.created_at),
    agent: row.actor_type === 'human' ? 'human' : row.actor_id || 'SYSTEM',
    taskId: undefined,
    kind: isHumanFollowup ? 'human_followup' : row.type,
    msg: text,
  }
}

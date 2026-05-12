// CrHITLPopout — full prompt card for the human to answer the agent's question.

import { useEffect, useMemo, useState } from 'react'
import type { HitlItem, Task } from '../data/tasks'
import { FeedDot } from './atoms/feed-dot'
import { AgentHtml } from './atoms/agent-html'
import { getTaskEvents, type TaskHistoryEvent } from '../lib/api/krewhub-client'

export type HitlSubmit =
  | { kind: 'answer'; text: string }
  | { kind: 'cancel' }

interface CrHITLPopoutProps {
  item: HitlItem | null
  task?: Task
  onClose?: () => void
  onShowFeed?: () => void
  onSubmit?: (payload: HitlSubmit) => void
}

interface ConvTurn {
  /** Original 1-based turn number (1 = oldest). */
  no: number
  /** Operator prompt for this turn. Undefined for the rare opening
   *  turn where the agent spoke first (eg. system-initiated tasks). */
  human?: { text: string; at: string }
  /** Agent's reply that closes this turn. Undefined when the operator
   *  has spoken but the agent hasn't replied yet — that's the
   *  unanswered state the popout was opened to resolve. */
  agent?: { html: string; at: string }
}

/** Pull the dialog text out of an event (payload.text → body). */
function dialogText(ev: TaskHistoryEvent): string {
  const p = ev.payload || {}
  if (typeof p.text === 'string' && p.text.trim()) return p.text
  return ev.body || ''
}

/** Walk the tape oldest-first and pair (HUMAN, ASSISTANT) into turns.
 *  Skips thinking / tool_* / milestone / session_* — those belong in
 *  the event feed, not in the operator-facing conversation view. */
function buildTurns(events: readonly TaskHistoryEvent[]): ConvTurn[] {
  const turns: ConvTurn[] = []
  let current: ConvTurn | null = null
  for (const ev of events) {
    if (ev.type !== 'agent_reply') continue
    const text = dialogText(ev).trim()
    if (!text) continue
    const at = ev.created_at
    if (ev.actor_type === 'human') {
      // A new human turn always opens a fresh turn slot.
      if (current && (current.human || current.agent)) turns.push(current)
      current = { no: turns.length + 1, human: { text, at } }
    } else {
      // Agent reply attaches to the in-flight turn, or starts one of
      // its own when the agent speaks unprompted (opening greeting).
      if (!current) current = { no: turns.length + 1 }
      // If the in-flight turn already has an agent reply, the agent
      // sent multiple messages in a single turn — concatenate so the
      // operator sees the full chain.
      if (current.agent) {
        current.agent = {
          html: `${current.agent.html}\n${text}`,
          at,
        }
      } else {
        current.agent = { html: text, at }
      }
    }
  }
  if (current && (current.human || current.agent)) turns.push(current)
  // Re-number sequentially in case we dropped any incomplete slots.
  return turns.map((t, i) => ({ ...t, no: i + 1 }))
}

export function CrHITLPopout({ item, task, onClose, onShowFeed, onSubmit }: CrHITLPopoutProps) {
  const [answer, setAnswer] = useState('')
  const [events, setEvents] = useState<TaskHistoryEvent[]>([])
  const [turnIndex, setTurnIndex] = useState<number>(-1) // -1 = latest

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  // Fetch the full conversation tape so the popout can paginate over
  // every prior (HUMAN, ASSISTANT) turn — not just the most recent one.
  const taskId = item?.taskId
  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    void (async () => {
      try {
        const { events: rows } = await getTaskEvents(taskId, { limit: 400 })
        if (!cancelled) {
          setEvents(rows)
          setTurnIndex(-1) // jump to the newest turn on load
        }
      } catch {
        // best-effort; the popout falls back to the elicit prompt
      }
    })()
    return () => {
      cancelled = true
    }
  }, [taskId])

  const turns = useMemo(() => buildTurns(events), [events])
  const safeIndex = turns.length === 0 ? -1 : turnIndex < 0 ? turns.length - 1 : Math.min(turnIndex, turns.length - 1)
  const turn = safeIndex >= 0 ? turns[safeIndex] : null
  const isLatest = safeIndex === turns.length - 1
  // Awaiting reply = newest turn has a human prompt but no agent reply.
  // That's the state the HITL card was opened to resolve, so we color
  // the popout border / chrome rose; resolved turns flip to amber and
  // historic turns dim into cream.
  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null
  const awaitingReply = !!latestTurn && !!latestTurn.human && !latestTurn.agent
  const turnState: 'awaiting' | 'resolved' | 'historic' = !turn
    ? 'awaiting'
    : !isLatest
      ? 'historic'
      : turn.agent
        ? 'resolved'
        : 'awaiting'

  if (!item) return null

  // Color tones reflect conversation state:
  //   awaiting  — blocked / awaiting reply (rose)
  //   resolved  — latest turn answered (amber)
  //   historic  — navigating prior turn (cool ink)
  const tones = {
    awaiting: { accent: '#DC2626', bg: '#FEF2F2', tag: 'BLOCKED · AWAITING REPLY' },
    resolved: { accent: '#0B4F2E', bg: '#E8FAEF', tag: 'RESOLVED · LATEST TURN' },
    historic: { accent: '#1E3A8A', bg: '#EEF2FF', tag: 'HISTORY · READ-ONLY' },
  } as const
  const { accent, bg, tag } = tones[turnState]
  // Human (operator) and agent (brain) bubble colors follow the dialog
  // contrast used in the event feed: cyan = operator turn, phosphor-
  // green = assistant turn.
  const HUMAN_INK = '#0369A1'
  const HUMAN_BG = 'rgba(56,189,248,0.10)'
  const HUMAN_BORDER = 'rgba(56,189,248,0.45)'
  const AGENT_INK = '#0B4F2E'
  const AGENT_BG = 'rgba(74,222,128,0.08)'
  const AGENT_BORDER = 'rgba(74,222,128,0.45)'

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
        animation: 'cr-fadein 160ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cr-bevel"
        style={{
          width: 'min(440px, 94vw)',
          maxHeight: '82vh',
          overflow: 'auto',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span className="cr-led red" />
            <span className="cr-kicker" style={{ fontSize: 8, color: accent, letterSpacing: 0.7 }}>
              {tag}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onShowFeed && <FeedDot tone="rose" onClick={() => onShowFeed()} />}
            <button
              onClick={onClose}
              className="cr-bevel"
              style={{
                padding: '2px 8px',
                background: 'var(--cream-hi)',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 9,
                cursor: 'pointer',
              }}
            >
              ESC ✕
            </button>
          </div>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Turn navigator: ◀ N / total ▶  -- read-only when no
              prior history; the chevrons step through (HUMAN reply,
              AGENT reply) pairs. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
              #{task?.no ?? '??'} · FROM {item.from}
              {awaitingReply ? ` · PENDING ${item.pending}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => setTurnIndex((i) => Math.max(0, (i < 0 ? turns.length - 1 : i) - 1))}
                disabled={turns.length === 0 || safeIndex <= 0}
                className="cr-bevel"
                title="Previous turn"
                aria-label="previous turn"
                style={{
                  padding: '2px 8px',
                  background: 'var(--cream-hi)',
                  fontFamily: 'JetBrains Mono,monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: turns.length === 0 || safeIndex <= 0 ? 'not-allowed' : 'pointer',
                  opacity: turns.length === 0 || safeIndex <= 0 ? 0.4 : 1,
                }}
              >
                ◀
              </button>
              <span
                className="cr-mono"
                style={{ fontSize: 10, color: 'var(--ink-soft)', minWidth: 56, textAlign: 'center' }}
              >
                {turns.length === 0
                  ? 'no turns'
                  : `turn ${safeIndex + 1} / ${turns.length}`}
              </span>
              <button
                type="button"
                onClick={() =>
                  setTurnIndex((i) => Math.min(turns.length - 1, (i < 0 ? turns.length - 1 : i) + 1))
                }
                disabled={turns.length === 0 || safeIndex >= turns.length - 1}
                className="cr-bevel"
                title="Next turn"
                aria-label="next turn"
                style={{
                  padding: '2px 8px',
                  background: 'var(--cream-hi)',
                  fontFamily: 'JetBrains Mono,monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    turns.length === 0 || safeIndex >= turns.length - 1 ? 'not-allowed' : 'pointer',
                  opacity:
                    turns.length === 0 || safeIndex >= turns.length - 1 ? 0.4 : 1,
                }}
              >
                ▶
              </button>
            </div>
          </div>

          {/* HUMAN bubble — operator's prompt for this turn. Cyan ink. */}
          {turn?.human && (
            <div
              className="cr-bevel"
              style={{
                background: HUMAN_BG,
                borderColor: HUMAN_BORDER,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                className="cr-kicker"
                style={{ fontSize: 8, color: HUMAN_INK, letterSpacing: 0.7 }}
              >
                ▸ HUMAN · {turn.human.at.slice(11, 19)}
              </span>
              <div
                style={{
                  fontFamily: 'Inter,sans-serif',
                  fontSize: 14,
                  color: HUMAN_INK,
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontWeight: 600,
                }}
              >
                {turn.human.text}
              </div>
            </div>
          )}

          {/* AGENT bubble — assistant's reply for this turn. Phosphor-
              green ink. Renders HTML via AgentHtml. Empty when the turn
              is unanswered (the case the operator is here to resolve). */}
          <div
            className="cr-bevel"
            style={{
              background: turn?.agent ? AGENT_BG : 'var(--cream-md)',
              borderColor: turn?.agent ? AGENT_BORDER : 'var(--line-soft)',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            <span
              className="cr-kicker"
              style={{
                fontSize: 8,
                color: turn?.agent ? AGENT_INK : accent,
                letterSpacing: 0.7,
              }}
            >
              {turn?.agent
                ? `▸ AGENT · ${turn.agent.at.slice(11, 19)}`
                : '▸ AWAITING AGENT REPLY'}
            </span>
            {turn?.agent ? (
              <AgentHtml html={turn.agent.html} />
            ) : (
              <div
                style={{
                  fontFamily: 'Inter,sans-serif',
                  fontSize: 14,
                  color: 'var(--ink)',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {item.question || 'The agent needs your input to continue.'}
              </div>
            )}
          </div>

          <div>
            <label className="cr-kicker" style={{ fontSize: 8, color: 'var(--ink-soft)' }}>
              YOUR ANSWER
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Type your answer — task returns to OPEN on send…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (answer.trim()) onSubmit?.({ kind: 'answer', text: answer })
                }
              }}
              className="cr-bevel"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                padding: 10,
                fontFamily: 'Inter,sans-serif',
                fontSize: 14,
                color: 'var(--ink)',
                background: 'var(--cream-md)',
                resize: 'none',
                outline: 'none',
              }}
            />
            <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
              ⌘↵ to send
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onSubmit?.({ kind: 'cancel' })}
              className="cr-bevel"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'var(--cream-hi)',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 11,
                letterSpacing: 0.6,
                cursor: 'pointer',
              }}
            >
              ⏸ HOLD
            </button>
            <button
              onClick={() => onSubmit?.({ kind: 'answer', text: answer })}
              disabled={!answer.trim()}
              className="cr-bevel"
              style={{
                flex: 2,
                padding: '10px 12px',
                background: answer.trim() ? 'var(--amber)' : 'var(--cream-md)',
                color: '#1A1408',
                borderColor: 'var(--amber-deep)',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 11,
                letterSpacing: 0.6,
                cursor: answer.trim() ? 'pointer' : 'not-allowed',
                boxShadow: answer.trim() ? '3px 3px 0 var(--amber-deep)' : 'none',
                opacity: answer.trim() ? 1 : 0.6,
              }}
            >
              ▸ SEND ANSWER
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

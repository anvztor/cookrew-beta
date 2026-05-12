// CrHITLPopout — full prompt card for the human to answer the agent's question.

import { useEffect, useState } from 'react'
import type { HitlItem, Task } from '../data/tasks'
import { FeedDot } from './atoms/feed-dot'
import { AgentHtml } from './atoms/agent-html'
import { getTaskLastReply, getTaskLastHumanInput } from '../lib/api/krewhub-client'

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

export function CrHITLPopout({ item, task, onClose, onShowFeed, onSubmit }: CrHITLPopoutProps) {
  const [answer, setAnswer] = useState('')
  const [humanInput, setHumanInput] = useState<{ text: string; kind: string } | null>(null)
  const [agentReply, setAgentReply] = useState<{ html: string; kind: string } | null>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  // Fetch latest human input + latest agent reply so the popout shows
  // the actual recent conversation (title = what the operator said,
  // body = what the agent answered) instead of a stale elicit prompt.
  const taskId = item?.taskId
  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    void (async () => {
      try {
        const [hi, lr] = await Promise.all([
          getTaskLastHumanInput(taskId),
          getTaskLastReply(taskId),
        ])
        if (!cancelled) {
          setHumanInput({ text: hi.text, kind: hi.kind })
          setAgentReply({ html: lr.html, kind: lr.kind })
        }
      } catch {
        // best-effort; fall back to the elicit prompt rendering
      }
    })()
    return () => {
      cancelled = true
    }
  }, [taskId])

  if (!item) return null

  const accent = '#DC2626'
  const bg = '#FEF2F2'
  const tag = 'BLOCKED · NEEDS INPUT'

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
          {/* TITLE = latest human input (operator's most recent prompt
              that landed this task here). Falls back to task.title for
              fresh tasks that have no follow-up yet. */}
          <div>
            <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
              #{task?.no ?? '??'} · FROM {item.from} · PENDING {item.pending}
              {humanInput?.kind === 'human_followup' ? ' · FOLLOW-UP' : ''}
            </div>
            <div
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ink)',
                lineHeight: 1.35,
                marginTop: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {humanInput?.text || task?.title || item.label}
            </div>
          </div>

          {/* BODY = latest agent_reply detail (the full HTML response
              that led to the block). Falls back to the elicit prompt
              for tasks with no agent_reply yet. */}
          <div
            className="cr-bevel"
            style={{
              background: 'var(--cream-md)',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 360,
              overflow: 'auto',
            }}
          >
            <span className="cr-kicker" style={{ fontSize: 8, color: accent }}>
              {agentReply?.kind === 'agent_reply' ? 'AGENT REPLY' : 'AGENT QUESTION'}
            </span>
            {agentReply && agentReply.html ? (
              <AgentHtml html={agentReply.html} />
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

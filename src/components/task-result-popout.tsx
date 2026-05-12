// CrTaskResultPopout — DONE-state card showing the brain's final answer
// as rendered HTML.
//
// Companion to the BLOCKED-state HITL popouts (CrInvocationElicitPopout +
// CrAuthRequiredPopout). Same visual style, opens on tap of a DONE
// task. Renders the brain's last `agent_reply` (or a designated
// final-summary string) via AgentHtml, with the same sanitization
// guarantees — see `atoms/agent-html.tsx`.
//
// Auto-open is the caller's choice (MobileApp dispatches on task tap
// when `task.status === 'done'`). The brain's HTML lands here without
// any plain-text fallback path, so the brain should emit content even
// for trivial DONE states (e.g. `<p>Done.</p>`).

import { useEffect } from 'react'

import { AgentHtml } from './atoms/agent-html'
import type { Task } from '../data/tasks'


interface CrTaskResultPopoutProps {
  /** The DONE task — used for the header (title, agent). */
  task: Task | null
  /** Brain's final agent_reply for this task, expected to be HTML. */
  resultHtml: string
  onClose?: () => void
}


export function CrTaskResultPopout({
  task, resultHtml, onClose,
}: CrTaskResultPopoutProps) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  if (!task) return null

  const accent = '#16A34A'  // emerald/green for DONE
  const bg = '#F0FDF4'

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
          width: 'min(520px, 94vw)',
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
            <span className="cr-led green" />
            <span
              className="cr-kicker"
              style={{ fontSize: 8, color: accent, letterSpacing: 0.7 }}
            >
              DONE · {task.assignee.toUpperCase()}
            </span>
          </div>
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

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {task.no} · {task.title}
          </div>

          {resultHtml ? (
            <AgentHtml
              html={resultHtml}
              className="cr-agent-html"
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 14,
                color: 'var(--ink)',
                lineHeight: 1.5,
              }}
            />
          ) : (
            <div
              className="cr-mono"
              style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}
            >
              (no result body — brain ended the task without a final reply)
            </div>
          )}
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: `1px solid ${accent}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="cr-bevel"
            style={{
              padding: '6px 14px',
              background: accent,
              color: 'white',
              fontFamily: 'Silkscreen,monospace',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  )
}

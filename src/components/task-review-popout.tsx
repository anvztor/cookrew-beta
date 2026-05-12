// CrTaskReviewPopout — PLS_REVIEW card for the DONE / cooked task state.
//
// Opens when the operator taps a task whose status is `done` or `cooked`.
// Renders the brain's final response (fetched from
// GET /api/v1/tasks/{task_id}/last-reply) via AgentHtml so the brain can
// include semantic HTML structure: status header, prose summary, diff
// in <pre><code>, artifacts as <a> links, follow-up checklist as <ul>.
//
// Two complementary CTAs (cookrew bundle lifecycle):
//   • APPROVE → mark cooked → done (operator accepts the work)
//   • SEND BACK → reopen the task (re-claim cycle)
// Both wired to whatever endpoint cookrew-beta uses for that today;
// CTA callbacks fall back to closing the popout if not provided.
//
// Theme: amber/gold accent. This is the "human, please look at this"
// surface — visually distinct from BLOCKED (rose) and DONE-cleared
// (emerald).

import { useEffect, useState } from 'react'

import { AgentHtml } from './atoms/agent-html'
import type { Task } from '../data/tasks'


const KREWHUB =
  (import.meta.env.VITE_KREWHUB_URL as string | undefined) ??
  'http://localhost:8420'


interface LastReply {
  html: string
  kind: 'agent_reply' | 'milestone' | 'none'
  created_at: string | null
}


interface CrTaskReviewPopoutProps {
  /** The DONE / cooked task being reviewed. */
  task: Task | null
  onClose?: () => void
  /** Optional: operator approves the work. Closes popout on success. */
  onApprove?: (task: Task) => Promise<void> | void
  /** Optional: operator sends the task back for more work. */
  onSendBack?: (task: Task) => Promise<void> | void
  /** Operator types a follow-up prompt and submits — the host wires
   *  this to "create new task on the same bundle" (or a dedicated
   *  follow-up endpoint later). Returning resolves closes the popout. */
  onFollowUp?: (task: Task, prompt: string) => Promise<void> | void
}


async function fetchLastReply(taskId: string): Promise<LastReply> {
  const r = await fetch(`${KREWHUB}/api/v1/tasks/${taskId}/last-reply`, {
    credentials: 'include',
  })
  if (!r.ok) {
    return { html: '', kind: 'none', created_at: null }
  }
  return (await r.json()) as LastReply
}


export function CrTaskReviewPopout({
  task, onClose, onApprove, onSendBack, onFollowUp,
}: CrTaskReviewPopoutProps) {
  const [reply, setReply] = useState<LastReply | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionInFlight, setActionInFlight] = useState<'approve' | 'sendback' | 'followup' | null>(null)
  const [followUpPrompt, setFollowUpPrompt] = useState('')

  useEffect(() => {
    if (!task) return
    setLoading(true)
    setError(null)
    setReply(null)
    fetchLastReply(task.id)
      .then((r) => setReply(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [task?.id])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionInFlight) onClose?.()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, actionInFlight])

  if (!task) return null

  // PLS_REVIEW theme — amber/gold. Visually distinct from BLOCKED (rose)
  // and from approved-DONE (emerald — but we don't render that state).
  const accent = '#D97706'
  const bg = '#FFFBEB'

  const isCooked = task.status === 'cooked'
  const reviewTag = isCooked ? 'PLS REVIEW · COOKED' : `DONE · ${task.assignee.toUpperCase()}`

  const handleApprove = async () => {
    if (!onApprove) {
      onClose?.()
      return
    }
    setActionInFlight('approve')
    try {
      await onApprove(task)
      onClose?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionInFlight(null)
    }
  }

  const handleSendBack = async () => {
    if (!onSendBack) {
      onClose?.()
      return
    }
    setActionInFlight('sendback')
    try {
      await onSendBack(task)
      onClose?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionInFlight(null)
    }
  }

  const handleFollowUp = async () => {
    const prompt = followUpPrompt.trim()
    if (!prompt || !onFollowUp) return
    setActionInFlight('followup')
    setError(null)
    try {
      await onFollowUp(task, prompt)
      setFollowUpPrompt('')
      onClose?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionInFlight(null)
    }
  }

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
      onClick={actionInFlight ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cr-bevel"
        style={{
          width: 'min(560px, 94vw)',
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
            <span className="cr-led yellow" />
            <span
              className="cr-kicker"
              style={{ fontSize: 8, color: accent, letterSpacing: 0.7 }}
            >
              {reviewTag}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={!!actionInFlight}
            className="cr-bevel"
            style={{
              padding: '2px 8px',
              background: 'var(--cream-hi)',
              fontFamily: 'Silkscreen,monospace',
              fontSize: 9,
              cursor: actionInFlight ? 'not-allowed' : 'pointer',
              opacity: actionInFlight ? 0.5 : 1,
            }}
          >
            ESC ✕
          </button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {task.no} · {task.title}
          </div>

          {/* Stats strip — adds/dels from task model */}
          {(task.adds > 0 || task.dels > 0) && (
            <div
              className="cr-mono"
              style={{
                fontSize: 10,
                display: 'flex',
                gap: 12,
                color: 'var(--muted)',
              }}
            >
              <span style={{ color: '#16A34A' }}>+{task.adds}</span>
              <span style={{ color: '#DC2626' }}>−{task.dels}</span>
              {task.role && <span>· {task.role}</span>}
            </div>
          )}

          {/* Brain's final reply — rendered as sanitized HTML */}
          {loading && (
            <div className="cr-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Loading agent response…
            </div>
          )}
          {!loading && reply && reply.kind !== 'none' && (
            <AgentHtml
              html={reply.html}
              className="cr-agent-html"
              style={{
                fontFamily: 'Inter,sans-serif',
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.5,
              }}
            />
          )}
          {!loading && reply && reply.kind === 'none' && (
            <div
              className="cr-mono"
              style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}
            >
              (no final reply found for this task)
            </div>
          )}
          {error && (
            <div className="cr-mono" style={{ fontSize: 11, color: '#DC2626' }}>
              {error}
            </div>
          )}

          {/* Follow-up — same shape as BLOCKED composer. Bare textarea,
              right-aligned send button. ⌘/Ctrl+Enter to submit. */}
          {onFollowUp && (
            <>
              <textarea
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                disabled={!!actionInFlight}
                placeholder="Reply…"
                rows={2}
                className="cr-bevel"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontFamily: 'Inter,sans-serif',
                  fontSize: 13,
                  lineHeight: 1.4,
                  resize: 'vertical',
                  minHeight: 48,
                  background: 'var(--cream-hi)',
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void handleFollowUp()
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleFollowUp}
                  disabled={!followUpPrompt.trim() || !!actionInFlight}
                  className="cr-bevel"
                  style={{
                    padding: '6px 14px',
                    background:
                      followUpPrompt.trim() && !actionInFlight
                        ? accent
                        : '#9CA3AF',
                    color: 'white',
                    fontFamily: 'Silkscreen,monospace',
                    fontSize: 10,
                    cursor:
                      followUpPrompt.trim() && !actionInFlight
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  {actionInFlight === 'followup' ? 'SENDING…' : 'SEND'}
                </button>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: `1px solid ${accent}`,
            display: 'flex',
            justifyContent: isCooked ? 'space-between' : 'flex-end',
            gap: 8,
          }}
        >
          {isCooked && (
            <button
              onClick={handleSendBack}
              disabled={!!actionInFlight}
              className="cr-bevel"
              style={{
                padding: '6px 14px',
                background: 'var(--cream-hi)',
                color: '#DC2626',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 10,
                cursor: actionInFlight ? 'not-allowed' : 'pointer',
              }}
            >
              {actionInFlight === 'sendback' ? 'SENDING…' : 'SEND BACK'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={!!actionInFlight}
              className="cr-bevel"
              style={{
                padding: '6px 14px',
                background: 'var(--cream-hi)',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 10,
                cursor: actionInFlight ? 'not-allowed' : 'pointer',
              }}
            >
              CLOSE
            </button>
            {isCooked && (
              <button
                onClick={handleApprove}
                disabled={!!actionInFlight}
                className="cr-bevel"
                style={{
                  padding: '6px 14px',
                  background: accent,
                  color: 'white',
                  fontFamily: 'Silkscreen,monospace',
                  fontSize: 10,
                  cursor: actionInFlight ? 'not-allowed' : 'pointer',
                }}
              >
                {actionInFlight === 'approve' ? 'APPROVING…' : 'APPROVE'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

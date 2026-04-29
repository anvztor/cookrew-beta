// MissionComposer — pinned bottom input + Ship button.
//
// Posts to POST /bundles/{id}/tasks via krewhub-client.createTask.
// On success, calls onCreated(task, sandbox) so mission-board can
// mount a TaskLiveCard. On 400 no_paired_agent, surfaces a hint
// directing the user to "Hire an agent first".

import { forwardRef, useState, type KeyboardEvent } from 'react'
import { CrButton } from './atoms/atoms'
import { createTask, type Sandbox, type Task } from '../lib/api/krewhub-client'

interface Props {
  bundleId: string
  onCreated: (task: Task, sandbox: Sandbox) => void
  onNeedsAgent?: () => void
  disabled?: boolean
}

export const MissionComposer = forwardRef<HTMLInputElement, Props>(
  function MissionComposer({ bundleId, onCreated, onNeedsAgent, disabled }, ref) {
    const [text, setText] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
      const title = text.trim()
      if (!title || busy || disabled) return
      setBusy(true)
      setError(null)
      try {
        const { task, sandbox } = await createTask(bundleId, title)
        setText('')
        onCreated(task, sandbox)
      } catch (e) {
        const err = e as { code?: string; message?: string }
        if (err.code === 'no_paired_agent') {
          setError('Hire an agent first')
          onNeedsAgent?.()
        } else {
          setError(err.message ?? 'Failed to ship')
        }
      } finally {
        setBusy(false)
      }
    }

    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit()
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '2px solid var(--line, #1a1a1a)',
          background: 'var(--cream-hi, #faf6ec)',
          alignItems: 'center',
        }}
      >
        <input
          ref={ref}
          className="cr-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Describe a mission and ship it…"
          style={{ flex: 1 }}
          disabled={disabled || busy}
        />
        <CrButton
          variant="primary"
          onClick={() => {
            void submit()
          }}
          disabled={busy || disabled || !text.trim()}
        >
          {busy ? 'Shipping…' : 'Ship'}
        </CrButton>
        {error && (
          <span
            style={{
              color: 'crimson',
              fontSize: 12,
              maxWidth: 200,
            }}
          >
            {error}
          </span>
        )}
      </div>
    )
  },
)

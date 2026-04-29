// TaskLiveCard — renders an in-flight task and subscribes to the
// task's SSE stream. Updates last-line + status pill on each event.
//
// Status transitions we honor in v1:
//   sandbox.attached  → status = 'running'
//   task.completed    → status = 'completed'
// All other event kinds update the last line of agent output.

import { useEffect, useState } from 'react'
import { streamTask, type Task } from '../lib/api/krewhub-client'

interface Props {
  task: Task
}

export function TaskLiveCard({ task }: Props) {
  const [status, setStatus] = useState(task.status)
  const [lastLine, setLastLine] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    )

    const es = streamTask(task.id)
    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          kind?: string
          payload?: { line?: string; sandbox_id?: string }
        }
        if (data.kind === 'agent.output.line' && data.payload?.line) {
          setLastLine(String(data.payload.line))
        } else if (data.kind === 'task.completed') {
          setStatus('completed')
        } else if (data.kind === 'sandbox.attached') {
          setStatus('running')
        }
      } catch {
        // ignore malformed event lines
      }
    }
    es.addEventListener('message', onMessage)

    return () => {
      clearInterval(tick)
      es.removeEventListener('message', onMessage)
      es.close()
    }
  }, [task.id])

  return (
    <div
      className="cr"
      style={{
        border: '2px solid var(--line, #1a1a1a)',
        padding: 10,
        background: 'var(--cream-hi, #faf6ec)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        marginTop: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <strong>{task.title}</strong>
        <span style={{ fontSize: 10, opacity: 0.8 }}>{status}</span>
      </div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>
        {elapsed}s · sandbox {task.sandbox_id ?? '—'}
      </div>
      {lastLine && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'Silkscreen, monospace',
            fontSize: 10,
            opacity: 0.85,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lastLine.slice(0, 120)}
        </div>
      )}
    </div>
  )
}

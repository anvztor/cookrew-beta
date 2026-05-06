// Real SSE feed for a recipe.
//
// Subscribes to `GET /api/v1/recipes/{recipe_id}/stream` and converts the
// typed SSE events into display rows. Replaces the in-process event-bus
// frontend narration: every line in the EventFeed below now corresponds
// to a real backend mutation.

import { useEffect, useRef, useState } from 'react'

const KREWHUB =
  (import.meta.env.VITE_KREWHUB_URL as string | undefined) ?? 'http://localhost:8420'

export interface RecipeEvent {
  /** Stable id for keying React lists — synthesized client-side. */
  id: string
  /** HH:MM:SS for display. */
  t: string
  /** Source label (BUNDLE / TASK / AGENT / SYS / runtime-id). */
  src: string
  /** Lowercase event kind name from the server, e.g. 'task.updated'. */
  kind: string
  /** Human-readable single-line summary. */
  msg: string
}

const MAX_EVENTS = 400

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function shortId(v: unknown): string {
  const s = asString(v)
  if (!s) return '?'
  // Trim long uuid/agent ids to something readable
  return s.length > 14 ? s.slice(0, 14) + '…' : s
}

function summarise(eventName: string, payload: Record<string, unknown>): {
  src: string
  msg: string
} {
  // event.added rows carry the rich per-task agent activity: thinking,
  // tool_use, tool_result, agent_reply, session_*, milestone, etc. The
  // server provides `body` (human-readable) + `type` (kind) + `actor_id`
  // so we can render exactly what the agent did.
  if (eventName === 'event.added' || eventName === 'event.modified') {
    const type = asString(payload.type) || 'event'
    const actor = asString(payload.actor_id) || 'SYS'
    const body = asString(payload.body)
    const taskId = shortId(payload.task_id)
    const head = body || type
    return {
      src: actor.toUpperCase().split('@')[0] || 'AGENT',
      msg: `${taskId} ${type} · ${head.slice(0, 120)}`,
    }
  }

  const [scope] = eventName.split('.')
  switch (scope) {
    case 'bundle': {
      const id = shortId(payload.id ?? payload.bundle_id)
      const status = asString(payload.status) || eventName.split('.')[1]
      return { src: 'BUNDLE', msg: `${id} → ${status}` }
    }
    case 'task': {
      const id = shortId(payload.id ?? payload.task_id)
      const status = asString(payload.status) || 'updated'
      const claimedBy = asString(payload.claimed_by_agent_id) || asString(payload.assigned_agent_id)
      const tail = claimedBy ? ` · ${claimedBy}` : ''
      return { src: 'TASK', msg: `${id} → ${status}${tail}` }
    }
    case 'agent': {
      const id = asString(payload.agent_id) || shortId(payload.id)
      const status = asString(payload.status) || 'presence'
      const task = asString(payload.current_task_id)
      const tail = task ? ` · on ${shortId(task)}` : ''
      return { src: 'AGENT', msg: `${id} ${status}${tail}` }
    }
    case 'digest': {
      const id = shortId(payload.id)
      return { src: 'DIGEST', msg: `${id} ${eventName.split('.')[1] ?? ''}` }
    }
    case 'sandbox': {
      const id = shortId(payload.id ?? payload.sandbox_id)
      const status = asString(payload.status) || eventName.split('.')[1]
      return { src: 'SANDBOX', msg: `${id} → ${status}` }
    }
    default: {
      // Fallback: stringified-payload preview.
      const s = JSON.stringify(payload)
      return { src: scope.toUpperCase() || 'SYS', msg: s.length > 140 ? s.slice(0, 140) + '…' : s }
    }
  }
}

// Event types the krewhub recipe stream emits. The router maps watch
// service events through `_to_legacy_event_name` — these names cover
// the full mapping plus the default `<resource>.<event>` fallback.
const KNOWN_EVENT_TYPES = [
  'bundle.created',
  'bundle.modified',
  'bundle.decision',
  'bundle.digest_submitted',
  'task.added',
  'task.updated',
  'task.modified',
  'task.created',
  'task.completed',
  'task.message',
  'agent.presence',
  'agent.modified',
  'digest.added',
  'digest.modified',
  'sandbox.attached',
  'sandbox.released',
  // Per-task agent activity: thinking / tool_use / tool_result / agent_reply
  // / session_start / session_end / milestone — all delivered as
  // event.added rows by the watch service.
  'event.added',
  'event.modified',
  'ping',
]

export function useRecipeStream(recipeId: string | undefined): RecipeEvent[] {
  const [events, setEvents] = useState<RecipeEvent[]>([])
  const seqRef = useRef(0)

  useEffect(() => {
    if (!recipeId) return
    const url = `${KREWHUB}/api/v1/recipes/${recipeId}/stream`
    const es = new EventSource(url, { withCredentials: true })

    const append = (eventName: string, raw: string) => {
      if (eventName === 'ping') return
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
      } catch {
        // ignore — keep payload empty so the summariser shows the kind
      }
      const { src, msg } = summarise(eventName, payload)
      seqRef.current += 1
      const ev: RecipeEvent = {
        id: `sse_${seqRef.current}_${Date.now()}`,
        t: nowStamp(),
        src,
        kind: eventName,
        msg,
      }
      setEvents((cur) => {
        const next = [...cur, ev]
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
      })
    }

    const listeners: Record<string, (e: MessageEvent) => void> = {}
    KNOWN_EVENT_TYPES.forEach((t) => {
      const fn = (e: MessageEvent) => append(t, e.data ?? '')
      es.addEventListener(t, fn)
      listeners[t] = fn
    })
    // Catch-all for any unnamed events — server-side fallbacks land here
    // when the watch event type isn't in KNOWN_EVENT_TYPES.
    const onMsg = (e: MessageEvent) => append('message', e.data ?? '')
    es.addEventListener('message', onMsg)

    es.onerror = () => {
      // Connection drops will auto-reconnect via EventSource. Surface
      // the disconnect once so the operator knows the channel blinked.
      seqRef.current += 1
      setEvents((cur) => {
        const last = cur[cur.length - 1]
        if (last && last.kind === 'sse.error') return cur
        return [
          ...cur,
          {
            id: `sse_err_${seqRef.current}`,
            t: nowStamp(),
            src: 'SSE',
            kind: 'sse.error',
            msg: 'channel reconnecting…',
          },
        ]
      })
    }

    return () => {
      es.removeEventListener('message', onMsg)
      Object.entries(listeners).forEach(([t, fn]) => es.removeEventListener(t, fn))
      es.close()
    }
  }, [recipeId])

  return events
}

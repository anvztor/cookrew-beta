// Invocation Contract slice 5 — frontend SSE wiring.
//
// Two hooks:
//   • useInvocationStream(invocationId) — direct subscription to one
//     invocation's events, used by the popout to refresh as the brain
//     responds.
//   • usePendingElicits(recipeId) — surfaces invocations across the
//     recipe that emitted an `elicit` and haven't reached `done` yet.
//     Drives the operator's "hey, an agent is asking you something"
//     awareness without polling.

import { useEffect, useRef, useState } from 'react'

import type { InvocationEvent, ResultEnvelope } from './krewhub-client'

const KREWHUB =
  (import.meta.env.VITE_KREWHUB_URL as string | undefined) ??
  'http://localhost:8420'


export interface PendingElicit {
  invocationId: string
  tapeId: string
  message: string
  schema: Record<string, unknown> | null
  deadlineTs: string | null
  raisedAt: string
  // Structured op shape, set when HumanHand received a typed delegate input
  // like {op: "auth_required", host, env_var_name, reason}. Renderers
  // discriminate on `op` to show a typed card instead of a generic form.
  op?: string | null
  host?: string | null
  envVarName?: string | null
  reason?: string | null
}


/**
 * Subscribe to a single invocation's tape via the dedicated SSE
 * endpoint. Returns the running list of events; the consumer can
 * derive `latestKind`, `terminal`, etc.
 */
export function useInvocationStream(
  invocationId: string | undefined,
): InvocationEvent[] {
  const [events, setEvents] = useState<InvocationEvent[]>([])
  const seenRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    setEvents([])
    seenRef.current = new Set()
    if (!invocationId) return

    const url = `${KREWHUB}/api/v1/invocations/${invocationId}/stream`
    const es = new EventSource(url, { withCredentials: true })

    const onMsg = (e: MessageEvent) => {
      let parsed: InvocationEvent
      try {
        parsed = JSON.parse(e.data) as InvocationEvent
      } catch {
        return
      }
      if (typeof parsed?.id !== 'number') return
      if (seenRef.current.has(parsed.id)) return
      seenRef.current.add(parsed.id)
      setEvents((cur) => [...cur, parsed])
    }
    // The /invocations/:id/stream endpoint emits unnamed messages
    // (default 'message' event). The recipe-scoped /watch endpoint
    // tags events with a channel — see usePendingElicits below.
    es.addEventListener('message', onMsg)

    return () => {
      es.removeEventListener('message', onMsg)
      es.close()
    }
  }, [invocationId])

  return events
}


/**
 * Watch the recipe-scoped watch stream for invocation events whose
 * kind is `elicit` and surface them as PendingElicit items. Removes an
 * item once the same tape emits `done` / `decision`.
 *
 * Backed by the existing /api/v1/watch endpoint with
 * resource_type=invocation&recipe_id=<recipe>.
 *
 * Stale-elicit filter: invocations whose `deadline_ts` is already in
 * the past are dropped from the live list and re-checked every 15s.
 * Without this, expired elicits from prior sessions block fresh ones —
 * the operator submits to a deadline_exceeded invocation while the new
 * one times out behind it.
 */
export function usePendingElicits(
  recipeId: string | undefined,
): PendingElicit[] {
  const [pending, setPending] = useState<Map<string, PendingElicit>>(new Map())
  // Sweep tick — bumps every 15s so React re-renders the filtered list
  // and live-evicts items whose deadline_ts has just passed.
  const [, setSweepTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSweepTick((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setPending(new Map())
    if (!recipeId) return

    const url = `${KREWHUB}/api/v1/watch?resource_type=invocation&recipe_id=${encodeURIComponent(recipeId)}`
    const es = new EventSource(url, { withCredentials: true })

    const handle = (e: MessageEvent) => {
      let envelope: {
        resource_id?: string
        object?: {
          kind?: string
          tape_id?: string
          payload?: Record<string, unknown>
          ts?: string
        }
      }
      try {
        envelope = JSON.parse(e.data ?? '{}')
      } catch {
        return
      }
      const obj = envelope.object
      if (!obj || typeof obj !== 'object') return
      const tapeId = obj.tape_id ?? envelope.resource_id
      if (typeof tapeId !== 'string') return

      if (obj.kind === 'elicit') {
        const payload = (obj.payload ?? {}) as Record<string, unknown>
        const message = typeof payload.message === 'string' ? payload.message : ''
        const schema =
          payload.schema && typeof payload.schema === 'object'
            ? (payload.schema as Record<string, unknown>)
            : null
        const deadlineTs =
          typeof payload.deadline_ts === 'string' ? payload.deadline_ts : null

        // The TapeWriter tags every watch envelope with `invocation_id`
        // alongside `tape_id` so the operator UI can submit results
        // without an extra resolve round-trip.
        const invocationId =
          typeof (obj as Record<string, unknown>).invocation_id === 'string'
            ? ((obj as Record<string, unknown>).invocation_id as string)
            : tapeId
        // Optional structured op fields (auth_required and friends).
        const op = typeof payload.op === 'string' ? payload.op : null
        const host = typeof payload.host === 'string' ? payload.host : null
        const envVarName =
          typeof payload.env_var_name === 'string' ? payload.env_var_name : null
        const reason = typeof payload.reason === 'string' ? payload.reason : null

        const item: PendingElicit = {
          invocationId,
          tapeId,
          message,
          schema,
          deadlineTs,
          raisedAt: obj.ts ?? new Date().toISOString(),
          op,
          host,
          envVarName,
          reason,
        }
        setPending((cur) => {
          const next = new Map(cur)
          next.set(tapeId, item)
          return next
        })
      } else if (obj.kind === 'done' || obj.kind === 'decision') {
        // Decision arrives just before done; either is enough to clear.
        setPending((cur) => {
          if (!cur.has(tapeId)) return cur
          const next = new Map(cur)
          next.delete(tapeId)
          return next
        })
      }
    }

    // The watch endpoint emits events under channel names. For
    // invocation events, the krewhub watch service computes channels
    // like `invocation:modified` / `invocation:added`. EventSource
    // event names are case-sensitive, so we register every shape we've
    // seen in the wire.
    const eventNames = [
      'message',
      'invocation:modified',
      'invocation:added',
      'MODIFIED',
      'ADDED',
    ]
    eventNames.forEach((n) => es.addEventListener(n, handle))

    return () => {
      eventNames.forEach((n) => es.removeEventListener(n, handle))
      es.close()
    }
  }, [recipeId])

  // Filter out invocations whose deadline_ts has passed. We can't
  // submit to an expired invocation anyway (the krewhub side will
  // already have closed it with action=cancel reason=deadline_exceeded
  // by then), and surfacing them blocks operators from reaching the
  // freshest live elicit behind them.
  const now = Date.now()
  const live: PendingElicit[] = []
  for (const item of pending.values()) {
    if (!item.deadlineTs) {
      live.push(item)
      continue
    }
    const t = Date.parse(item.deadlineTs)
    if (Number.isFinite(t) && t > now) live.push(item)
  }
  // Surface most-recent first so freshly-raised elicits pop ahead of
  // older live ones.
  live.sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt))
  return live
}


/** Build a default `accept` envelope from a schema-driven form payload. */
export function buildAcceptEnvelope(
  content: Record<string, unknown> | string,
): ResultEnvelope {
  return { action: 'accept', content }
}

export function buildCancelEnvelope(reason = 'operator_dismissed'): ResultEnvelope {
  return { action: 'cancel', reason }
}

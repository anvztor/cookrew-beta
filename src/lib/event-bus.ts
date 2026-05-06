// Reactive event bus for the live mission feed.
// Replaces the static CR_EVENTS array. emitEvent() pushes a new entry;
// useEvents() subscribes via useReducer and re-renders on every push.

import { useEffect, useReducer } from 'react'

export type EventKind =
  | 'info'
  | 'bundle'
  | 'claim'
  | 'think'
  | 'tool'
  | 'code'
  | 'done'
  | 'milestone'
  | 'block'
  | 'warn'
  | 'prompt'
  | 'review'
  | 'diff'

export interface FeedEvent {
  id: string
  t: string
  src: string
  kind: EventKind
  msg: string
}

type Listener = (e: FeedEvent) => void

const MAX_EVENTS = 400
const eventLog: FeedEvent[] = []
const listeners = new Set<Listener>()

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export interface EmitInput {
  src?: string
  kind?: EventKind
  msg: string
  t?: string
}

export function emitEvent(e: EmitInput): FeedEvent {
  const evt: FeedEvent = {
    id: `e_${(eventLog.length + 1).toString(36)}_${Date.now()}`,
    t: e.t ?? nowStamp(),
    src: e.src ?? 'SYS',
    kind: e.kind ?? 'info',
    msg: e.msg,
  }
  eventLog.push(evt)
  if (eventLog.length > MAX_EVENTS) {
    eventLog.splice(0, eventLog.length - MAX_EVENTS)
  }
  listeners.forEach((fn) => {
    try {
      fn(evt)
    } catch {
      // listener errors don't break the bus
    }
  })
  return evt
}

export function getEvents(): readonly FeedEvent[] {
  return eventLog
}

export function useEvents(): readonly FeedEvent[] {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const fn = () => force()
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return eventLog
}

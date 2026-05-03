import type { PortraitId } from '../components/atoms/sprite'

export type RosterStatus = 'on' | 'busy' | 'off'
export type RosterKind = 'human' | 'agent'

export interface RosterMember {
  id: string
  kind: RosterKind
  name: string
  sub: string
  portrait: PortraitId
  hp: number
  max: number
  used: number
  ctxMax: number
  status: RosterStatus
}

export const CR_ROSTER: RosterMember[] = []

export type EventKind = 'bundle' | 'claim' | 'think' | 'diff' | 'done' | 'block' | 'review'

export interface FeedEvent {
  t: string
  src: string
  kind: EventKind
  msg: string
}

export const CR_EVENTS: FeedEvent[] = []

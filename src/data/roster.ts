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

export const CR_ROSTER: RosterMember[] = [
  { id: 'alex',    kind: 'human', name: 'ALEX',       sub: 'OPERATOR',            portrait: 'human',      hp: 92,  max: 100, used: 0,     ctxMax: 0,     status: 'on'   },
  { id: 'scout',   kind: 'agent', name: 'SCOUT',      sub: 'GPT-5-MINI · 3 tools', portrait: 'scout',      hp: 78,  max: 100, used: 38000, ctxMax: 50000, status: 'busy' },
  { id: 'gate',    kind: 'agent', name: 'GATEKEEPER', sub: 'OPUS · 4 tools',       portrait: 'gatekeeper', hp: 100, max: 100, used: 12000, ctxMax: 50000, status: 'on'   },
  { id: 'brewer',  kind: 'agent', name: 'BREWER',     sub: 'SONNET · 6 tools',     portrait: 'brewer',     hp: 64,  max: 100, used: 47000, ctxMax: 50000, status: 'busy' },
  { id: 'patcher', kind: 'agent', name: 'PATCHER',    sub: 'HAIKU · 2 tools',      portrait: 'patcher',    hp: 22,  max: 100, used: 0,     ctxMax: 50000, status: 'off'  },
]

export type EventKind = 'bundle' | 'claim' | 'think' | 'diff' | 'done' | 'block' | 'review'

export interface FeedEvent {
  t: string
  src: string
  kind: EventKind
  msg: string
}

export const CR_EVENTS: FeedEvent[] = [
  { t: '14:22:09', src: 'SYS',        kind: 'bundle', msg: '>> BUNDLE bun_4a2c CREATED · 5 quests seeded' },
  { t: '14:22:14', src: 'SCOUT',      kind: 'claim',  msg: '@scout CLAIMED quest #01 "heartbeat endpoint"' },
  { t: '14:22:31', src: 'SCOUT',      kind: 'think',  msg: 'reading krewcli/heartbeat.py …' },
  { t: '14:22:48', src: 'SCOUT',      kind: 'diff',   msg: 'patch +86/−12 in 2 files' },
  { t: '14:23:02', src: 'SCOUT',      kind: 'done',   msg: 'CLEARED #01 in 53s · digest bun_4a2c.01' },
  { t: '14:23:11', src: 'SCOUT',      kind: 'claim',  msg: '@scout CLAIMED quest #02 "retry on flaky DNS"' },
  { t: '14:23:34', src: 'SCOUT',      kind: 'block',  msg: 'BLOCKED · DNS resolver mock missing — needs human' },
  { t: '14:23:38', src: 'GATEKEEPER', kind: 'review', msg: 'review queued for #01' },
  { t: '14:23:40', src: 'BREWER',     kind: 'claim',  msg: '@brewer CLAIMED quest #03 "sandbox reset"' },
  { t: '14:23:55', src: 'BREWER',     kind: 'think',  msg: 'spawning sandbox sbx_a91 …' },
]

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
  runtime?: string
  pid?: number
}

export const CR_ROSTER_INITIAL: RosterMember[] = [
  {
    id: 'alex',
    kind: 'human',
    name: 'ALEX',
    sub: 'OPERATOR',
    portrait: 'human',
    hp: 92,
    max: 100,
    used: 0,
    ctxMax: 0,
    status: 'on',
  },
]

// Detectable agent runtimes — surface during the "Hire Agent" runtime scan.
export const CR_DETECTABLE_AGENTS: RosterMember[] = [
  {
    id: 'scout',
    kind: 'agent',
    name: 'SCOUT',
    sub: 'GPT-5-MINI · 3 tools',
    portrait: 'scout',
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 50_000,
    status: 'on',
    runtime: '~/.krew/agents/scout',
    pid: 12480,
  },
  {
    id: 'gate',
    kind: 'agent',
    name: 'GATEKEEPER',
    sub: 'OPUS · 4 tools',
    portrait: 'gatekeeper',
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 50_000,
    status: 'on',
    runtime: '~/.krew/agents/gatekeeper',
    pid: 12491,
  },
  {
    id: 'brewer',
    kind: 'agent',
    name: 'BREWER',
    sub: 'SONNET · 6 tools',
    portrait: 'brewer',
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 50_000,
    status: 'on',
    runtime: '~/.krew/agents/brewer',
    pid: 12503,
  },
  {
    id: 'patcher',
    kind: 'agent',
    name: 'PATCHER',
    sub: 'HAIKU · 2 tools',
    portrait: 'patcher',
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 50_000,
    status: 'on',
    runtime: '~/.krew/agents/patcher',
    pid: 12517,
  },
]

// Legacy export — empty array kept so older imports continue to compile;
// the live roster is owned by MobileApp state.
export const CR_ROSTER: RosterMember[] = []

// ── Runtime → RosterMember projection ───────────────────────────
// Krewhub stores `agent_runtimes` rows; the design's roster is the UI
// projection. We need to invent a few presentational fields (portrait,
// hp/ctx) that the daemon doesn't track.

const PORTRAITS_ORDER: PortraitId[] = ['scout', 'gatekeeper', 'brewer', 'patcher']

function pickPortrait(seed: string): PortraitId {
  const h = seed.toLowerCase()
  if (h.includes('scout')) return 'scout'
  if (h.includes('gate')) return 'gatekeeper'
  if (h.includes('brew')) return 'brewer'
  if (h.includes('patch')) return 'patcher'
  // Stable hash → deterministic portrait per runtime id.
  let acc = 0
  for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) | 0
  return PORTRAITS_ORDER[Math.abs(acc) % PORTRAITS_ORDER.length]
}

function shortName(agentId: string, runtimeId: string): string {
  // agent_id is typically `<bundle_id>` or `<provider>@<owner>` — pick
  // the leftmost token and uppercase. Fallback to a runtime-id suffix
  // so we never display "BUN" for every paired agent.
  const left = agentId.split(/[@_]/)[0] || agentId
  if (/^bun$/i.test(left) || left === agentId) {
    return `AGENT-${runtimeId.replace(/^rt_/, '').slice(0, 4).toUpperCase()}`
  }
  return left.toUpperCase()
}

export interface RuntimeView {
  id: string
  agent_id: string
  account_id: string
  daemon_version: string | null
  provider: string | null
  host_info: Record<string, unknown>
  status: string
  last_seen_at: string
  started_at: string
}

function runtimeDeviceKey(rt: RuntimeView): string {
  const host = rt.host_info || {}
  const device =
    typeof host['device_id'] === 'string'
      ? host['device_id']
      : typeof host['hostname'] === 'string'
        ? host['hostname']
        : typeof host['endpoint_url'] === 'string'
          ? host['endpoint_url']
          : rt.id
  return `${rt.account_id}:${rt.agent_id}:${rt.provider ?? ''}:${device}`
}

export function dedupeLiveDaemonRuntimes<T extends RuntimeView>(runtimes: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const rt of runtimes) {
    if (rt.status === 'offline') continue
    // Pairing placeholders have neither a provider nor daemon metadata;
    // they are not actual running agents and should not fill PARTY.
    if (!rt.provider && !rt.daemon_version) continue
    const key = runtimeDeviceKey(rt)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(rt)
  }
  return out
}

export function runtimeToRoster(rt: RuntimeView): RosterMember {
  const provider = rt.provider || 'krewcli'
  const subParts = [provider]
  if (rt.daemon_version) subParts.push(`v${rt.daemon_version}`)
  return {
    id: rt.id,
    kind: 'agent',
    name: shortName(rt.agent_id, rt.id),
    sub: subParts.join(' · '),
    portrait: pickPortrait(rt.agent_id || rt.id),
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 50_000,
    status: rt.status === 'online' ? 'on' : rt.status === 'offline' ? 'off' : 'on',
    runtime: typeof rt.host_info?.['runtime'] === 'string'
      ? (rt.host_info['runtime'] as string)
      : undefined,
    pid: typeof rt.host_info?.['pid'] === 'number'
      ? (rt.host_info['pid'] as number)
      : undefined,
  }
}

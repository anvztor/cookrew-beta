// Task model — covers the full lifecycle:
//   draft   : prompt-bound placeholder card (dotted, edits inline)
//   open    : specced, unclaimed (UNCLAIMED chip)
//   working : claimed by an agent, in progress
//   done    : pushed + cleared
//   blocked : working + needs human input (HITL)
//   queued  : enqueued, not yet open
//   orch    : phosphor "PLANNING" card that decomposes into a bundle
//   cooked  : completed, awaiting human approval (bundle-level)

export type TaskStatus =
  | 'draft'
  | 'open'
  | 'working'
  | 'done'
  | 'queued'
  | 'orch'
  | 'cooked'

export type HitlKind = 'needs_input'

export interface OrchLogLine {
  text: string
  tone?: 'dim' | 'hi'
}

export type OrchPhase = 'thinking' | 'planning' | 'spawning' | 'done'

export interface Task {
  id: string
  no: string
  title: string
  status: TaskStatus
  assignee: string
  role: string
  adds: number
  dels: number
  blocked?: boolean
  x: number
  y: number
  deps?: string[]

  // Draft / open lifecycle timestamps
  openedAt?: number
  workingAt?: number

  // HITL (blocked → needs human answer)
  hitl?: HitlKind
  hitlPending?: string
  hitlOverdue?: boolean
  hitlQuestion?: string
  hitlAt?: number

  // Orch / planning card
  orchPhase?: OrchPhase
  orchLog?: OrchLogLine[]
  bundleCount?: number
}

export const CR_TASKS: Task[] = []

export interface StatusStyle {
  bg: string
  ink: string
  label: string
}

export const CR_STATUS: Record<TaskStatus | 'blocked', StatusStyle> = {
  done:    { bg: '#D8F3E6',     ink: '#0B4F2E', label: 'CLEARED' },
  working: { bg: '#FFF3AD',     ink: '#5C4A1F', label: 'IN PROGRESS' },
  open:    { bg: '#E6F0FF',     ink: '#1E3A8A', label: 'OPEN' },
  queued:  { bg: '#F5F0E8',     ink: '#78716C', label: 'QUEUED' },
  blocked: { bg: '#FEF2F2',     ink: '#DC2626', label: 'BLOCKED' },
  cooked:  { bg: '#E8FAEF',     ink: '#0B4F2E', label: 'COOKED' },
  draft:   { bg: 'transparent', ink: '#78716C', label: 'DRAFT' },
  orch:    { bg: '#E8DEFB',     ink: '#5B21B6', label: 'PLANNING' },
}

export interface HitlItem {
  id: string
  taskId: string
  kind: HitlKind
  label: string
  from: string
  pending: string
  overdue: boolean
  question?: string
}

export const CR_HITL: HitlItem[] = []

export function deriveHitl(tasks: Task[]): HitlItem[] {
  return tasks
    .filter((t) => t.hitl === 'needs_input')
    .map((t) => ({
      id: 'hitl_' + t.id,
      taskId: t.id,
      kind: t.hitl as HitlKind,
      label: '#' + t.no + ' ' + (t.title || 'untitled'),
      from: t.assignee || 'AGENT',
      pending: t.hitlPending || '—',
      overdue: !!t.hitlOverdue,
      question: t.hitlQuestion,
    }))
}

// Mock questions agents ask the human when blocked.
export const MOCK_QUESTIONS: readonly string[] = [
  'I hit a missing DNS resolver mock — should I add a stub for `*.flaky.test`, or skip the test instead?',
  'Schema migration touches `users.email` — keep the legacy column for one release, or drop it now?',
  'The retry policy doubles latency on cold starts. Cap at 3 attempts, or surface as a config flag?',
  'Two libs disagree on the date format. Stick with ISO 8601 everywhere, or follow the upstream API?',
  'Rate limiter at 50 RPS will throttle one of our own services. Whitelist it, or raise the global cap?',
  'Sandbox needs network access to run the integration test. Allow egress to `api.stripe.com` only?',
  'Found two reasonable parser fixes — minimal patch (5 lines) or proper rewrite (~40 lines)?',
]

// Tiny mock decomposer — returns sub-quest titles based on the goal phrasing.
export function decomposeGoal(goal: string): string[] {
  const g = goal.toLowerCase()
  if (g.includes('heartbeat') || g.includes('reliab')) {
    return ['add /heartbeat endpoint', 'retry on flaky DNS', 'sandbox reset on timeout']
  }
  if (g.includes('auth') || g.includes('login') || g.includes('sign')) {
    return ['wire up SSO callback', 'session refresh on 401', 'logout flushes party state']
  }
  if (g.includes('test') || g.includes('flak')) {
    return ['identify flaky tests', 'quarantine + retry harness', 'replay digest in CI']
  }
  return [
    `scout · explore "${truncate(goal, 24)}"`,
    'brewer · implement core path',
    'patcher · ship + verify',
  ]
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

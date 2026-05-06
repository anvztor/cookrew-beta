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

  /** Logical agent identity (e.g. "echo@krew") so the event feed
   *  can pre-select the right tab on task click. Distinct from
   *  `assignee` which is a display string. */
  agentId?: string

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

// MOCK_QUESTIONS / decomposeGoal / truncate were removed when the mock
// lifecycle was cut. Real HITL questions arrive as bundle events; real
// task decomposition is a server-side planner concern, not a frontend
// mock.

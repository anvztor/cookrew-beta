export type TaskStatus = 'done' | 'working' | 'queued'

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
}

export const CR_TASKS: Task[] = [
  { id: 't1',  no: '01', title: 'Add heartbeat endpoint',         status: 'done',    assignee: 'SCOUT',      role: 'GPT-5-MINI', adds: 86, dels: 12, x: 40,   y: 60 },
  { id: 't2',  no: '02', title: 'Heartbeat retry on flaky DNS',   status: 'working', assignee: 'SCOUT',      role: 'GPT-5-MINI', adds: 24, dels: 4,  blocked: true, x: 320, y: 30,  deps: ['t1'] },
  { id: 't3',  no: '03', title: 'Sandbox reset script',           status: 'working', assignee: 'BREWER',     role: 'SONNET',     adds: 41, dels: 18, x: 320,  y: 200, deps: ['t1'] },
  { id: 't4',  no: '04', title: 'Write replay smoke test',        status: 'queued',  assignee: 'GATEKEEPER', role: 'OPUS',       adds: 0,  dels: 0,  x: 600,  y: 30,  deps: ['t2', 't3'] },
  { id: 't5',  no: '05', title: 'Patch deserialization bug',      status: 'queued',  assignee: 'PATCHER',    role: 'HAIKU',      adds: 0,  dels: 0,  x: 600,  y: 200, deps: ['t3'] },
  { id: 't6',  no: '06', title: 'Add chaos-monkey to CI',         status: 'queued',  assignee: 'GATEKEEPER', role: 'OPUS',       adds: 0,  dels: 0,  x: 880,  y: 30,  deps: ['t4'] },
  { id: 't7',  no: '07', title: 'Telemetry dashboard widget',     status: 'queued',  assignee: 'BREWER',     role: 'SONNET',     adds: 0,  dels: 0,  x: 880,  y: 200, deps: ['t4', 't5'] },
  { id: 't8',  no: '08', title: 'Migrate redis cluster mode',     status: 'queued',  assignee: 'PATCHER',    role: 'HAIKU',      adds: 0,  dels: 0,  x: 880,  y: 370, deps: ['t5'] },
  { id: 't9',  no: '09', title: 'Roll out behind feature flag',   status: 'queued',  assignee: 'SCOUT',      role: 'GPT-5-MINI', adds: 0,  dels: 0,  x: 1160, y: 115, deps: ['t6', 't7'] },
  { id: 't10', no: '10', title: 'Decommission legacy heartbeat',  status: 'queued',  assignee: 'GATEKEEPER', role: 'OPUS',       adds: 0,  dels: 0,  x: 1160, y: 285, deps: ['t7', 't8'] },
  { id: 't11', no: '11', title: 'Postmortem template',            status: 'queued',  assignee: 'BREWER',     role: 'SONNET',     adds: 0,  dels: 0,  x: 1440, y: 200, deps: ['t9', 't10'] },
]

export interface StatusStyle {
  bg: string
  ink: string
  label: string
}

export const CR_STATUS: Record<'done' | 'working' | 'queued' | 'blocked', StatusStyle> = {
  done:    { bg: '#D8F3E6', ink: '#0B4F2E', label: 'CLEARED' },
  working: { bg: '#FFF3AD', ink: '#5C4A1F', label: 'IN PROGRESS' },
  queued:  { bg: '#F5F0E8', ink: '#78716C', label: 'QUEUED' },
  blocked: { bg: '#FEF2F2', ink: '#DC2626', label: 'BLOCKED' },
}

export interface HitlItem {
  id: string
  task: string
  from: string
  pending: string
  overdue: boolean
}

export const CR_HITL: HitlItem[] = [
  { id: 'h1', task: '#02 retry on flaky DNS', from: 'SCOUT',      pending: '2m',  overdue: false },
  { id: 'h2', task: '#04 replay smoke test',  from: 'GATEKEEPER', pending: '7m',  overdue: true  },
  { id: 'h3', task: '#05 deserialize patch',  from: 'PATCHER',    pending: '12s', overdue: false },
]

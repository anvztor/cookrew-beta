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

export const CR_TASKS: Task[] = []

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

export const CR_HITL: HitlItem[] = []

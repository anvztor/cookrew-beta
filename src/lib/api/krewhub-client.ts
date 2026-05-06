// cookrew-beta -> krewhub HTTP + SSE client.
//
// All requests use `credentials: 'include'` so the browser sends the
// httpOnly `krewauth_session` cookie. KREWHUB_URL is configurable via
// VITE_KREWHUB_URL; defaults to localhost:8420 for dev.

const KREWHUB =
  (import.meta.env.VITE_KREWHUB_URL as string | undefined) ??
  'http://localhost:8420'

export interface Task {
  id: string
  bundle_id: string
  title: string
  description: string | null
  status: string
  assigned_runtime_id: string | null
  sandbox_id: string | null
}

export interface Sandbox {
  id: string
  task_id: string
  e2b_sandbox_id: string
  template: string
  status: string
}

export interface CreateTaskResult {
  task: Task
  sandbox: Sandbox
}

export interface KrewhubError extends Error {
  code?: string
  status?: number
}

function makeError(message: string, code?: string, status?: number): KrewhubError {
  const err = new Error(message) as KrewhubError
  err.code = code
  err.status = status
  return err
}

export async function createTask(
  bundleId: string,
  title: string,
  description = '',
): Promise<CreateTaskResult> {
  const r = await fetch(`${KREWHUB}/api/v1/bundles/${bundleId}/tasks`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const detail = body?.detail
    const code = typeof detail === 'object' && detail !== null ? detail.code : undefined
    const message =
      typeof detail === 'object' && detail !== null
        ? detail.message ?? `task_create_${r.status}`
        : typeof detail === 'string'
          ? detail
          : `task_create_${r.status}`
    throw makeError(message, code, r.status)
  }
  return r.json()
}

export function streamTask(taskId: string): EventSource {
  return new EventSource(
    `${KREWHUB}/api/v1/tasks/${taskId}/stream`,
    { withCredentials: true },
  )
}

export interface BundleSummary {
  id: string
  recipe_id?: string
  prompt?: string
  status?: string
  default_agent_runtime_id?: string | null
}

export async function getBundle(bundleId: string): Promise<BundleSummary | null> {
  const r = await fetch(`${KREWHUB}/api/v1/bundles/${bundleId}`, {
    credentials: 'include',
  })
  if (r.status === 404) return null
  if (!r.ok) throw makeError(`bundle_${r.status}`, undefined, r.status)
  const body = await r.json()
  return (body?.bundle ?? body) as BundleSummary
}

// ── Agent runtimes ─────────────────────────────────────────────
// One row per `krewcli daemon` process registered for an account.
// Created either at daemon startup (`POST /agents/runtime/register`)
// or via the inverted RFC 8628 pairing flow below.

export interface Runtime {
  id: string
  agent_id: string
  account_id: string
  daemon_version: string | null
  provider: string | null
  host_info: Record<string, unknown>
  status: 'online' | 'offline' | string
  last_seen_at: string
  started_at: string
}

export interface PairAgentResult {
  detail: string
  runtime_id: string
  bundle_id: string
}

export async function pairAgent(
  bundleId: string,
  userCode: string,
): Promise<PairAgentResult> {
  const r = await fetch(`${KREWHUB}/bundles/${bundleId}/pair-agent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_code: userCode.trim().toUpperCase() }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const detail = body?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail !== null
          ? (detail.message ?? `pair_failed_${r.status}`)
          : `pair_failed_${r.status}`
    const code =
      typeof detail === 'object' && detail !== null ? detail.code : undefined
    throw makeError(message, code, r.status)
  }
  return r.json()
}

export async function listRuntimes(accountId: string): Promise<Runtime[]> {
  const url = new URL(`${KREWHUB}/agents/runtimes`)
  url.searchParams.set('account_id', accountId)
  const r = await fetch(url.toString(), { credentials: 'include' })
  if (!r.ok) throw makeError(`runtimes_${r.status}`, undefined, r.status)
  const body = (await r.json()) as { runtimes?: Runtime[] }
  return body.runtimes ?? []
}

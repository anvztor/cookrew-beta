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
  /** Logical agent identity, e.g. "echo@krew". Drives event-feed
   *  agent tabs + per-task focus. */
  assigned_agent_id?: string | null
  /** Set once an agent actually claims the task. */
  claimed_by_agent_id?: string | null
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
  recipe_id: string
  prompt: string | null
  status: string
  created_by: string
  created_at: string
  owner_account_id: string | null
  default_agent_runtime_id: string | null
  /** Bundle-level e2b sandbox provisioned at create time. Null when
   *  the e2b orchestrator was unreachable; the SPA should surface a
   *  warning so the operator knows tasks will fail to run. */
  sandbox_id?: string | null
}

export interface BundleDetail {
  bundle: BundleSummary
  tasks: Task[]
  events: unknown[]
}

export async function getBundle(bundleId: string): Promise<BundleDetail | null> {
  const r = await fetch(`${KREWHUB}/api/v1/bundles/${bundleId}`, {
    credentials: 'include',
  })
  if (r.status === 404) return null
  if (!r.ok) throw makeError(`bundle_${r.status}`, undefined, r.status)
  return r.json()
}

// ── Cookbooks / recipes ────────────────────────────────────────
// Each user gets per-account cookbooks via `krewcli login`'s
// auto-bootstrap (creates "my-cookbook" + "my-recipe" if absent).
// The SPA discovers them on load instead of relying on a hardcoded
// recipe ID — that approach broke for any user who didn't happen to
// own the build-time-baked recipe.

export interface Cookbook {
  id: string
  name: string
  owner_id: string | null
  created_at: string
}

export interface Recipe {
  id: string
  name: string
  cookbook_id: string
  created_by: string
  created_at: string
}

export async function listCookbooks(ownerId?: string): Promise<Cookbook[]> {
  const url = new URL(`${KREWHUB}/api/v1/cookbooks`)
  if (ownerId) url.searchParams.set('owner_id', ownerId)
  const r = await fetch(url.toString(), { credentials: 'include' })
  if (!r.ok) throw makeError(`cookbooks_${r.status}`, undefined, r.status)
  const body = (await r.json()) as { cookbooks?: Cookbook[] }
  return body.cookbooks ?? []
}

export async function getCookbookDetail(cookbookId: string): Promise<{
  cookbook: Cookbook
  recipes: Recipe[]
}> {
  const r = await fetch(`${KREWHUB}/api/v1/cookbooks/${cookbookId}`, {
    credentials: 'include',
  })
  if (!r.ok) throw makeError(`cookbook_${r.status}`, undefined, r.status)
  return r.json()
}

/**
 * Resolve the current user's "active" recipe.
 *
 * Strategy:
 *   1. localStorage cache (krewhub_active_recipe_id) — survives reloads.
 *   2. First owned cookbook → first recipe inside it.
 *   3. POST /api/v1/me/init-workspace — server bootstraps a default
 *      cookbook + recipe for first-time web users who haven't run
 *      `krewcli login` on their machine yet. Idempotent.
 *   4. null when even init failed (network blip; UI surfaces a toast).
 */
export async function resolveActiveRecipeId(
  accountId: string,
): Promise<string | null> {
  const cached = localStorage.getItem('krewhub_active_recipe_id')
  if (cached) return cached
  const cookbooks = await listCookbooks(accountId)
  if (cookbooks.length > 0) {
    const detail = await getCookbookDetail(cookbooks[0].id)
    const recipe = detail.recipes[0]
    if (recipe) {
      localStorage.setItem('krewhub_active_recipe_id', recipe.id)
      return recipe.id
    }
  }
  // No cookbook yet → server-side bootstrap.
  const init = await initWorkspace().catch(() => null)
  if (init) {
    localStorage.setItem('krewhub_active_recipe_id', init.recipe.id)
    return init.recipe.id
  }
  return null
}

export interface InitWorkspaceResult {
  cookbook: Cookbook
  recipe: Recipe
}

export async function initWorkspace(): Promise<InitWorkspaceResult> {
  const r = await fetch(`${KREWHUB}/api/v1/me/init-workspace`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw makeError(`init_workspace_${r.status}`, undefined, r.status)
  return r.json()
}

export async function listBundles(recipeId: string): Promise<BundleSummary[]> {
  const r = await fetch(`${KREWHUB}/api/v1/recipes/${recipeId}/bundles`, {
    credentials: 'include',
  })
  if (!r.ok) throw makeError(`bundles_${r.status}`, undefined, r.status)
  const body = (await r.json()) as { bundles?: BundleSummary[] }
  return body.bundles ?? []
}

export async function createBundle(
  recipeId: string,
  prompt: string,
  opts: { autoplan?: boolean } = {},
): Promise<BundleSummary> {
  // autoplan defaults to false on the backend AND here. The SPA's
  // "+ NEW" button creates an inert bundle on purpose — operator
  // wants a blank board to drop tasks onto, not an LLM-generated
  // graph. Only orchestrator-mode flows that explicitly want
  // PlannerDispatchController to fire pass autoplan: true.
  const r = await fetch(`${KREWHUB}/api/v1/recipes/${recipeId}/bundles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      requested_by: 'cookrew-beta',
      tasks: [],
      autoplan: !!opts.autoplan,
    }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const detail = body?.detail
    const msg = typeof detail === 'string' ? detail : `bundle_create_${r.status}`
    throw makeError(msg, undefined, r.status)
  }
  const body = (await r.json()) as { bundle: BundleSummary }
  return body.bundle
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
  bundle_id?: string
}

/**
 * Pair an agent runtime to the caller's account.
 *
 * Calls krewhub `POST /agents/pair` (account-scoped). The older
 * `/bundles/{id}/pair-agent` route required an existing bundle owned
 * by the caller — we don't have one when the user is pairing their
 * first agent, so cookrew-beta uses the bundle-less variant. Krewhub
 * still relays the device-code approval to krewauth and creates an
 * `agent_runtimes` row owned by the caller.
 */
export async function pairAgent(userCode: string): Promise<PairAgentResult> {
  const r = await fetch(`${KREWHUB}/agents/pair`, {
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
  // The runtime list router is mounted under /api/v1; the bare
  // /agents/runtimes path 404s.
  const url = new URL(`${KREWHUB}/api/v1/agents/runtimes`)
  url.searchParams.set('account_id', accountId)
  const r = await fetch(url.toString(), { credentials: 'include' })
  if (!r.ok) throw makeError(`runtimes_${r.status}`, undefined, r.status)
  const body = (await r.json()) as { runtimes?: Runtime[] }
  return body.runtimes ?? []
}

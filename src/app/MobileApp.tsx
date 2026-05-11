import { useCallback, useEffect, useRef, useState } from 'react'
import { CallbackScreen } from '../components/auth-view/callback-screen'
import { OAuthResultScreen } from '../components/auth-view/oauth-result-screen'
import { CrEventFeed } from '../components/event-feed'
import { CrFooter } from '../components/footer'
import { CrHeader } from '../components/header'
import { CrMissionBoard } from '../components/mission-board'
import { CrPartySidebar } from '../components/party-sidebar'
import { HireAgentRuntimeModal } from '../components/auth-view/hire-agent-runtime-modal'
import { CrHITLPopout } from '../components/hitl-popout'
import { CrInvocationElicitPopout } from '../components/invocation-elicit-popout'
import { CrAuthRequiredPopout } from '../components/auth-required-popout'
import {
  usePendingElicits,
  type PendingElicit,
} from '../lib/api/invocation-stream'
import { redirectToLogin } from '../lib/auth/auth-client'
import { useAuth } from '../lib/auth/useAuth'
import {
  createBundle,
  createTask,
  getBundle,
  listBundles,
  listRuntimes,
  postHitlAnswer,
  resolveActiveRecipeId,
  submitInvocationResult,
  type Runtime,
  type Task as ApiTask,
} from '../lib/api/krewhub-client'
// Note: the in-process event-bus is intentionally NOT imported here.
// All on-screen events come from the krewhub recipe SSE stream
// (see CrEventFeed → useRecipeStream). Anything we'd emit here would
// be frontend narration, which is exactly what we removed.
import {
  dedupeLiveDaemonRuntimes,
  runtimeToRoster,
  type RosterMember,
} from '../data/roster'
import { deriveHitl, type HitlItem, type Task, type TaskStatus } from '../data/tasks'
import type { Bundle } from '../components/bundle-tabs'
import type { Account } from '../lib/auth/auth-client'

// Build-time fallback for local dev when no signed-in account is
// available. In prod we resolve the operator's actual recipe via
// resolveActiveRecipeId(account_id) on load — krewcli's auto-bootstrap
// creates a per-user "my-cookbook" / "my-recipe" with a generated ID
// that almost never matches a hardcoded constant.
const FALLBACK_RECIPE_ID =
  (import.meta.env.VITE_KREWHUB_RECIPE_ID as string | undefined) ?? ''

interface DesignBundle extends Bundle {
  /** Same as id — kept so the existing BundleTabs typing stays unchanged. */
  id: string
}

function mapStatus(backendStatus: string): TaskStatus {
  // Map krewhub task status strings → our UI lifecycle. Anything we
  // don't recognise lands in 'queued' — treated as inert/visible.
  switch (backendStatus) {
    case 'open':
    case 'pending':
      return 'open'
    case 'claimed':
    case 'working':
    case 'in_progress':
      return 'working'
    case 'done':
    case 'completed':
    case 'cleared':
      return 'done'
    case 'cooked':
      return 'cooked'
    case 'queued':
      return 'queued'
    default:
      return 'queued'
  }
}

/** Humanise an ISO timestamp into a "pending Xm/Xh" stamp for the
 *  HITL chip. Falls back to "—" when the input is missing. */
function _pendingFor(claimedAtIso: string | null | undefined): string {
  if (!claimedAtIso) return '—'
  const claimedMs = new Date(claimedAtIso).getTime()
  if (!Number.isFinite(claimedMs)) return '—'
  const deltaSec = Math.max(0, Math.floor((Date.now() - claimedMs) / 1000))
  if (deltaSec < 60) return deltaSec + 's'
  if (deltaSec < 3600) return Math.floor(deltaSec / 60) + 'm'
  if (deltaSec < 86400) return Math.floor(deltaSec / 3600) + 'h'
  return Math.floor(deltaSec / 86400) + 'd'
}

/** Humanise the agent's `blocked_reason` into a question the operator
 *  can answer. Empty/unknown reasons fall through to a generic prompt. */
function _humaniseBlockedReason(raw: string | null | undefined): string {
  const reason = (raw ?? '').trim()
  if (!reason) return 'The agent stopped without details. How would you like to proceed?'
  // Common machine codes → friendlier phrasing.
  if (/timed?\s*out|timeout/i.test(reason)) {
    return `${reason} — what should I try next? (refine the prompt, retry, or skip)`
  }
  if (/permission|denied|forbidden/i.test(reason)) {
    return `${reason} — how should I proceed past this access check?`
  }
  if (/no_paired_agent|paired/i.test(reason)) {
    return `${reason} — paste an agent code or hire a new one to continue.`
  }
  return `${reason} — please advise.`
}

function backendTaskToUi(t: ApiTask, idx: number): Task {
  const blocked = (t.status ?? '').toLowerCase() === 'blocked'
  // Logical agent identity — what the SSE stream's `actor_id` will
  // match. The runtime id is a UUID and can't be correlated with
  // event.added rows, so we surface the agent_id when available.
  const agentId =
    t.claimed_by_agent_id ?? t.assigned_agent_id ?? undefined
  const displayAssignee =
    agentId ??
    (t.assigned_runtime_id ? t.assigned_runtime_id.slice(0, 8) : '—')
  // Every blocked task is, by contract, a HITL item — the agent
  // gave up and the operator is the only thing that can move it
  // forward. Surface it through the existing HITLClickbar +
  // HITLPopout pipeline by tagging hitl='needs_input' and shipping
  // the blocked_reason as the agent's question.
  const claimedAtMs = t.claimed_at
    ? new Date(t.claimed_at).getTime()
    : undefined
  return {
    id: t.id,
    no: String(idx + 1).padStart(2, '0'),
    title: t.title || '(untitled)',
    status: mapStatus(t.status ?? 'queued'),
    assignee: displayAssignee,
    role: agentId ? 'AGENT' : '—',
    adds: 0,
    dels: 0,
    blocked,
    agentId: agentId ?? undefined,
    // Initial grid placement; CrTaskCanvas FORMAT button can re-layout.
    x: 24 + (idx % 4) * 240,
    y: 24 + Math.floor(idx / 4) * 156,
    // HITL surface — only populated when the backend says blocked.
    ...(blocked
      ? {
          hitl: 'needs_input' as const,
          hitlPending: _pendingFor(t.claimed_at),
          hitlOverdue: claimedAtMs
            ? Date.now() - claimedAtMs > 5 * 60 * 1000
            : false,
          hitlQuestion: _humaniseBlockedReason(t.blocked_reason),
          hitlAt: claimedAtMs,
        }
      : {}),
  }
}

function humanRosterFromAccount(acc: Account): RosterMember {
  const name = (acc.username || acc.account_id.slice(0, 8)).toUpperCase()
  return {
    id: acc.account_id,
    kind: 'human',
    name,
    sub: 'OPERATOR',
    portrait: 'human',
    hp: 100,
    max: 100,
    used: 0,
    ctxMax: 0,
    status: 'on',
  }
}

export function MobileApp() {
  const { state, logout } = useAuth()

  const [partyOpen, setPartyOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [hireOpen, setHireOpen] = useState(false)

  const [roster, setRoster] = useState<RosterMember[]>([])

  const [bundles, setBundles] = useState<DesignBundle[]>([])
  const [activeBundleId, setActiveBundleId] = useState<string>('')
  // Active recipe — resolved per-user on login, persisted in
  // localStorage. Empty string while loading; bundle/listing calls
  // wait until it's set.
  const [recipeId, setRecipeId] = useState<string>(FALLBACK_RECIPE_ID)
  const activeBundle = bundles.find((b) => b.id === activeBundleId)
  const tasks = activeBundle?.tasks ?? []

  const setTasks = useCallback(
    (updater: (cur: Task[]) => Task[]) => {
      setBundles((bs) =>
        bs.map((b) =>
          b.id !== activeBundleId
            ? b
            : { ...b, tasks: typeof updater === 'function' ? updater(b.tasks) : updater },
        ),
      )
    },
    [activeBundleId],
  )

  const [draftId, setDraftId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<string>('orch')
  const [toast, setToast] = useState<string | null>(null)
  const [formatTick] = useState(0)
  const [hitlOpen, setHitlOpen] = useState<HitlItem | null>(null)
  const [elicitOpen, setElicitOpen] = useState<PendingElicit | null>(null)
  // Auto-surface invocation-style HITL events from the recipe stream.
  const pendingElicits = usePendingElicits(recipeId || undefined)
  const [shipError, setShipError] = useState<string | null>(null)
  // When the user clicks an assigned task on the board we pop the
  // EventFeed open and pre-select that agent's tab + task focus.
  const [focusedTask, setFocusedTask] = useState<{
    taskId: string
    agentId?: string
  } | null>(null)

  const showToast = (msg: string, ms = 1800) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  const accountId = state.status === 'authed' ? state.account.account_id : undefined

  // ── 1. Roster: human from /me, agents from /api/v1/agents/runtimes ─
  const refreshRoster = useCallback(async (acc: Account) => {
    try {
      const runtimes = await listRuntimes(acc.account_id)
      const agents = dedupeLiveDaemonRuntimes(runtimes).map(runtimeToRoster)
      setRoster([humanRosterFromAccount(acc), ...agents])
    } catch (e) {
      const err = e as { message?: string }
      console.warn('roster fetch failed:', err.message)
      setRoster([humanRosterFromAccount(acc)])
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'authed') return
    void refreshRoster(state.account)
  }, [state, refreshRoster])

  // Auto-surface the next pending invocation-style elicit. If an
  // operator already has one open we leave it; otherwise we pop the
  // freshest one. `usePendingElicits` filters out expired and sorts
  // newest-first, so [0] is the most recently raised live elicit.
  useEffect(() => {
    if (elicitOpen) return
    if (pendingElicits.length === 0) return
    setElicitOpen(pendingElicits[0])
  }, [pendingElicits, elicitOpen])

  // Auto-close the popup if the invocation it's pinned to has reached
  // a terminal state on the server (server-side deadline expired,
  // operator-cancelled from elsewhere, or claude's session ended). The
  // pendingElicits hook removes terminal items; if the currently-open
  // invocation is no longer in the live list, the popup should close
  // and the next pending elicit (if any) auto-pop on the next tick.
  // Without this, operators submit "banana" into a terminal invocation
  // and get a confusing 409.
  useEffect(() => {
    if (!elicitOpen) return
    const stillLive = pendingElicits.some(
      (e) => e.invocationId === elicitOpen.invocationId,
    )
    if (!stillLive) setElicitOpen(null)
  }, [pendingElicits, elicitOpen])

  // ── 1.4 Post-pair landing — surface the freshly hired agent ─────
  // /auth/login confirm card → /agents/pair → redirects here with
  // ?paired=<runtime_id>. Kick the roster + bundles refresh
  // immediately so the new agent shows up without polling delay,
  // then strip the query param so a refresh later doesn't re-toast.
  useEffect(() => {
    if (state.status !== 'authed') return
    const url = new URL(window.location.href)
    const pairedId = url.searchParams.get('paired')
    if (!pairedId) return
    showToast('Agent online ✓', 2400)
    void refreshRoster(state.account)
    url.searchParams.delete('paired')
    window.history.replaceState({}, '', url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  // ── 1.5 Recipe discovery ────────────────────────────────────────
  // Each user gets their own cookbook + recipe via krewcli's
  // auto-bootstrap (`my-cookbook` / `my-recipe`). The IDs are
  // generated, not predictable, so the SPA must resolve them per
  // signed-in account. localStorage caches the result for snappy
  // reloads; ?recipe=<id> on the URL overrides the cache (used by
  // operators who own multiple recipes).
  useEffect(() => {
    if (state.status !== 'authed') return
    const overrideFromUrl = new URLSearchParams(window.location.search).get('recipe')
    if (overrideFromUrl) {
      localStorage.setItem('krewhub_active_recipe_id', overrideFromUrl)
      setRecipeId(overrideFromUrl)
      return
    }
    let cancelled = false
    void resolveActiveRecipeId(state.account.account_id)
      .then((id) => {
        if (cancelled) return
        if (id) {
          setRecipeId(id)
        } else if (FALLBACK_RECIPE_ID) {
          setRecipeId(FALLBACK_RECIPE_ID)
        } else {
          // resolveActiveRecipeId already tried POST /me/init-workspace;
          // if we still have nothing the network is genuinely down or
          // krewhub is offline. Surface a useful hint instead of the
          // legacy "still loading" stall.
          showToast(
            'Could not reach hub.cookrew.dev — refresh once it is back.',
            4200,
          )
        }
      })
      .catch((e) => {
        const err = e as { message?: string }
        console.warn('recipe discovery failed:', err.message)
        showToast(`recipe discovery failed: ${err.message ?? 'unknown'}`, 4200)
      })
    return () => {
      cancelled = true
    }
  }, [state])

  // ── 2. Bundle bootstrap: list bundles for the configured recipe ──
  // Real bundles only — no frontend-only `BUN_4A2C` placeholder.
  // Filters to bundles the caller actually owns (legacy bundles with
  // owner_account_id="<username>" instead of "<account_id>" 403 every
  // task creation; we hide them from the UI to avoid the "task stays
  // UNCLAIMED" trap on double-click + ship). Sorts newest-first so the
  // default active tab is one we just created.
  const refreshBundles = useCallback(async () => {
    if (state.status !== 'authed') return
    if (!recipeId) return  // Recipe still resolving — wait for it.
    const acc = state.account
    try {
      const summaries = await listBundles(recipeId)
      const owned = summaries.filter(
        (b) =>
          b.owner_account_id === acc.account_id ||
          (b.owner_account_id == null && b.created_by === acc.account_id),
      )
      owned.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const detailed = await Promise.all(
        owned.map(async (b) => {
          const detail = await getBundle(b.id)
          const tasksUi: Task[] =
            detail?.tasks.map((t, i) => backendTaskToUi(t, i)) ?? []
          return {
            id: b.id,
            name: b.prompt ? b.prompt.slice(0, 32) : b.id,
            tasks: tasksUi,
          } as DesignBundle
        }),
      )
      setBundles(detailed)
      setActiveBundleId((cur) => {
        if (cur && detailed.some((b) => b.id === cur)) return cur
        return detailed[0]?.id ?? ''
      })
    } catch (e) {
      const err = e as { message?: string }
      console.warn('bundle list failed:', err.message)
    }
  }, [state, recipeId])

  useEffect(() => {
    if (state.status !== 'authed') return
    if (!recipeId) return
    void refreshBundles()
  }, [state.status, recipeId, refreshBundles])

  // Light polling (every 6s) of the active bundle so completed-status
  // updates from the daemon are visible without per-task SSE wiring.
  //
  // CRITICAL: drafts are frontend-only (no backend record yet) — the
  // user just double-clicked the canvas and is typing the title. If
  // we replace tasks wholesale with detail.tasks, the draft disappears
  // before they can hit Enter. Merge: keep every local draft, replace
  // everything else with the backend snapshot.
  useEffect(() => {
    if (!activeBundleId) return
    const id = setInterval(async () => {
      try {
        const detail = await getBundle(activeBundleId)
        if (!detail) return
        const realTasks = detail.tasks.map((t, i) => backendTaskToUi(t, i))
        setBundles((bs) =>
          bs.map((b) => {
            if (b.id !== activeBundleId) return b
            const drafts = b.tasks.filter((t) => t.status === 'draft')
            return { ...b, tasks: [...realTasks, ...drafts] }
          }),
        )
      } catch {
        // transient errors — ignore; next tick will retry.
      }
    }, 6000)
    return () => clearInterval(id)
  }, [activeBundleId])

  // ── 3. Hire flow refreshes roster after pair ────────────────────
  const handlePaired = (runtimes: Runtime[]) => {
    const liveRuntimes = dedupeLiveDaemonRuntimes(runtimes)
    if (state.status === 'authed') {
      const human = humanRosterFromAccount(state.account)
      setRoster([human, ...liveRuntimes.map(runtimeToRoster)])
    }
    showToast(`Paired · ${liveRuntimes.length} agent${liveRuntimes.length === 1 ? '' : 's'} online`, 2400)
  }

  // ── 4. Bundle create (the "+ NEW" tab) — real POST ──────────────
  // Empty prompt + autoplan: false → backend skips planner dispatch.
  // The board renders blank; operator double-clicks to drop drafts,
  // then ships them as ordinary tasks. Orchestrator mode (the future
  // "compose a multi-step bundle from prompt" flow) is the only path
  // that should opt back into autoplan.
  const addBundle = async () => {
    if (state.status !== 'authed') return
    if (!recipeId) {
      showToast('Recipe still loading — try again in a moment.', 2400)
      return
    }
    try {
      const b = await createBundle(recipeId, '', { autoplan: false })
      setBundles((bs) => [
        ...bs,
        // Stable display name — the prompt is intentionally empty so
        // we render the bundle id slice instead of "New mission".
        { id: b.id, name: b.id.slice(0, 12).toUpperCase(), tasks: [] },
      ])
      setActiveBundleId(b.id)
      setDraftId(null)
      draftIdRef.current = null
      setPrompt('')
      // Backend provisions a bundle-scoped e2b sandbox synchronously at
      // create time. If sandbox_id came back null, e2b was unreachable
      // — every task in this bundle will hit "no sandbox" on ship.
      // Surface that loudly so the operator can retry instead of
      // discovering it task-by-task.
      if (!b.sandbox_id) {
        showToast(
          'Sandbox not provisioned — tasks will fail. Refresh and retry once e2b is reachable.',
          4200,
        )
      }
      // Real bundle.created event will appear in the feed via SSE.
    } catch (e) {
      const err = e as { message?: string }
      showToast(`Bundle create failed: ${err.message}`, 2600)
    }
  }
  // Bundle close/rename are local-only UX (krewhub has no delete/rename).
  const closeBundle = (id: string) => {
    setBundles((bs) => bs.filter((b) => b.id !== id))
    if (id === activeBundleId) {
      setActiveBundleId((cur) => {
        const next = bundles.find((b) => b.id !== cur)
        return next?.id ?? ''
      })
    }
  }
  const renameBundle = (id: string, name: string) => {
    setBundles((bs) => bs.map((b) => (b.id === id ? { ...b, name } : b)))
  }

  // ── 5. Drafts (local pre-ship UI only) ──────────────────────────
  // Single-draft policy: if a draft is already on the board, an extra
  // double-click moves it to the new pointer location instead of
  // spawning a duplicate. The v8-design "leave prior drafts on board"
  // behaviour produced confusing TWO-DRAFT screens whenever the user
  // dblclicked twice in quick succession — React batches the
  // setDraftId(...) call so a second dblclick that fires before the
  // re-render still sees `draftId === null` and races a fresh draft
  // through. We track the live draft id in a ref so the second
  // dblclick sees it synchronously and short-circuits.
  const draftIdRef = useRef<string | null>(null)
  const addDraft = ({ x, y }: { x: number; y: number }) => {
    if (!activeBundleId) {
      showToast('Hire an agent or wait for a bundle to load first', 2400)
      return
    }
    if (draftIdRef.current) {
      // Already drafting — just relocate the existing card to the
      // new click point so the operator gets visible feedback. No
      // new draft is created and no state is reset.
      const cur = draftIdRef.current
      setTasks((ts) => ts.map((t) => (t.id === cur ? { ...t, x, y } : t)))
      return
    }
    const id = 'd' + Date.now()
    draftIdRef.current = id
    const no = String(tasks.length + 1).padStart(2, '0')
    setTasks((ts) => [
      ...ts,
      {
        id,
        no,
        title: '',
        status: 'draft',
        assignee: '—',
        role: '—',
        adds: 0,
        dels: 0,
        x,
        y,
      },
    ])
    setDraftId(id)
    setPrompt('')
    setMode('assign')
  }
  const cancelDraft = useCallback(() => {
    if (!draftId) return
    setTasks((ts) => ts.filter((t) => t.id !== draftId))
    setDraftId(null)
    draftIdRef.current = null
    setPrompt('')
    setMode('orch')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])

  useEffect(() => {
    if (!draftId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDraft()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draftId, cancelDraft])

  useEffect(() => {
    if (!draftId) return
    setTasks((ts) => ts.map((t) => (t.id === draftId ? { ...t, title: prompt } : t)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, draftId])

  // Tab cycles modes (kept; no backend coupling)
  const MODES = ['orch', 'assign', 'ask'] as const
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      e.stopPropagation()
      const dir = e.shiftKey ? -1 : 1
      const i = MODES.indexOf(mode as (typeof MODES)[number])
      const next = MODES[((i + dir) % MODES.length + MODES.length) % MODES.length]
      setMode(next)
      showToast(`MODE · ${next.toUpperCase()}`, 1200)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Local link edit — purely visual; krewhub doesn't accept inline dep edits yet.
  const linkTasks = (srcId: string, tgtId: string) => {
    if (!srcId || !tgtId || srcId === tgtId) return
    setTasks((ts) => {
      const tgt = ts.find((t) => t.id === tgtId)
      const src = ts.find((t) => t.id === srcId)
      if (!tgt || !src) return ts
      const existing = tgt.deps ?? []
      if (existing.includes(srcId)) {
        showToast('Already linked', 1600)
        return ts
      }
      const depMap: Record<string, string[]> = Object.fromEntries(
        ts.map((t) => [t.id, t.deps ?? []]),
      )
      const stack = [srcId]
      const seen = new Set<string>()
      while (stack.length) {
        const id = stack.pop()!
        if (id === tgtId) {
          showToast('Would create a cycle', 1800)
          return ts
        }
        if (seen.has(id)) continue
        seen.add(id)
        ;(depMap[id] || []).forEach((d) => stack.push(d))
      }
      showToast(`Linked #${src.no} → #${tgt.no} (local)`, 1600)
      return ts.map((t) => (t.id === tgtId ? { ...t, deps: [...existing, srcId] } : t))
    })
  }

  // formatTick is supplied directly to CrMissionBoard; nothing else
  // triggers a relayout right now (FORMAT button lives inside the canvas).

  // ── 6. Ship — real backend createTask ───────────────────────────
  // No mock lifecycle. The daemon will pick up the OPEN task and the
  // 6s polling refresh will surface the state transitions.
  //
  // Resilience: legacy bundles in this recipe have owner_account_id
  // set to the caller's username (not account_id) and 403 with "Not
  // your bundle" on task create. If our active bundle is wedged like
  // that — or has no paired runtime — we transparently create a fresh
  // bundle (which auto-binds to the most-recent live runtime) and
  // retry. Without this, the "double-click → ship → stays UNCLAIMED"
  // trap reappears every time the user lands on a stale tab.
  const shipReal = async (
    text: string,
    { allowRecover = true }: { allowRecover?: boolean } = {},
  ): Promise<ApiTask | null> => {
    if (!activeBundleId) {
      setShipError('No bundle yet — refresh in a few seconds.')
      return null
    }
    try {
      const { task } = await createTask(activeBundleId, text)
      setShipError(null)
      // The real task.added / task.updated event will land in the feed
      // via the recipe SSE stream — no frontend narration needed.
      return task
    } catch (e) {
      const err = e as { code?: string; message?: string; status?: number }
      const recoverable =
        allowRecover &&
        (err.code === 'no_paired_agent' ||
          err.status === 403 ||
          err.status === 404 ||
          err.message === 'Not your bundle' ||
          err.message === 'Bundle not found')
      if (recoverable && recipeId) {
        try {
          // Recovery bundle: just a fresh container for the user's
          // typed task. No autoplan — they're shipping a one-shot
          // task, not asking the planner for a graph.
          const fresh = await createBundle(recipeId, text.slice(0, 64), {
            autoplan: false,
          })
          setBundles((bs) => [
            { id: fresh.id, name: fresh.prompt ?? fresh.id, tasks: [] },
            ...bs.filter((b) => b.id !== fresh.id),
          ])
          setActiveBundleId(fresh.id)
          showToast(`Active bundle was wedged — created ${fresh.id.slice(0, 12)}…`, 2400)
          // Retry once against the fresh bundle.
          const { task } = await createTask(fresh.id, text)
          setShipError(null)
          return task
        } catch (e2) {
          const err2 = e2 as { code?: string; message?: string }
          const detail2 =
            err2.code === 'no_paired_agent'
              ? 'Hire an agent first'
              : (err2.message ?? 'Failed to ship after recover')
          setShipError(detail2)
          return null
        }
      }
      const detail =
        err.code === 'no_paired_agent'
          ? 'Hire an agent first'
          : (err.message ?? 'Failed to ship')
      setShipError(detail)
      return null
    }
  }

  const handleSend = async ({ text }: { mode: string; text: string }) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (draftId) {
      // Replace the draft with the real task on success.
      const oldId = draftId
      const apiTask = await shipReal(trimmed)
      setDraftId(null)
      draftIdRef.current = null
      setPrompt('')
      if (apiTask) {
        setTasks((ts) => {
          const filtered = ts.filter((t) => t.id !== oldId)
          return [...filtered, backendTaskToUi(apiTask, filtered.length)]
        })
        showToast('Quest opened — awaiting agent…', 1800)
      } else {
        // Keep the draft so the user can retry.
        setDraftId(oldId)
        draftIdRef.current = oldId
        setPrompt(trimmed)
      }
      return
    }
    // No active draft — ship a one-shot task. (No mock orch
    // decomposition; if the user wants a multi-step plan they can ship
    // tasks individually.)
    await shipReal(trimmed)
    setPrompt('')
  }

  const onSelectTask = (t: Task) => {
    if (t.hitl === 'needs_input') {
      const list = deriveHitl(tasks)
      const it = list.find((h) => h.taskId === t.id)
      if (it) {
        setHitlOpen(it)
        return
      }
    }
    if (t.status === 'draft') {
      setDraftId(t.id)
      setPrompt(t.title || '')
      setMode('assign')
      return
    }
    // Any non-draft, non-hitl task: pop the event feed open and focus
    // it on this task's agent. Even if the agent hasn't claimed yet
    // (agentId undefined), opening the feed against the taskId is the
    // useful default.
    setFocusedTask({ taskId: t.id, agentId: t.agentId })
    setPartyOpen(false)
    setFeedOpen(true)
  }

  // ── Auth gate ───────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'anon' && window.location.pathname !== '/auth/callback') {
      void redirectToLogin()
    }
  }, [state.status])

  if (window.location.pathname === '/auth/callback') {
    return <CallbackScreen />
  }
  if (window.location.pathname === '/oauth-result') {
    return <OAuthResultScreen />
  }
  if (state.status === 'loading' || state.status === 'anon') {
    return (
      <div
        style={{
          padding: 32,
          fontFamily: 'Inter,sans-serif',
          background: 'var(--cream)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state.status === 'anon' ? 'Redirecting to sign-in…' : 'Loading…'}
      </div>
    )
  }

  const closeDrawers = () => {
    setPartyOpen(false)
    setFeedOpen(false)
    setFocusedTask(null)
  }
  const cls = `cr cr-app${partyOpen ? ' party-open' : ''}${feedOpen ? ' feed-open' : ''}`
  const liveHitl = deriveHitl(tasks)
  const onlineCount = roster.filter((r) => r.status !== 'off').length

  return (
    <div className={cls} data-screen-label="Arcade · Mobile">
      <CrHeader
        variant="mobile"
        bundle={activeBundleId}
        online={onlineCount}
        total={roster.length}
        username={state.account.username}
        accountId={state.account.account_id}
        partyOpen={partyOpen}
        feedOpen={feedOpen}
        onMenu={() => {
          setFeedOpen(false)
          setPartyOpen((o) => !o)
        }}
        onFeed={() => {
          setPartyOpen(false)
          setFeedOpen((o) => !o)
        }}
        onAvatar={() => void logout()}
      />

      <div className="cr-stage">
        <CrMissionBoard
          variant="mobile"
          tasks={tasks}
          hitl={liveHitl}
          bundles={bundles as Bundle[]}
          activeBundleId={activeBundleId}
          onSelectBundle={setActiveBundleId}
          onAddBundle={() => void addBundle()}
          onCloseBundle={closeBundle}
          onRenameBundle={renameBundle}
          onAddDraft={addDraft}
          draftId={draftId}
          onLinkTasks={linkTasks}
          formatTick={formatTick}
          onSelectTask={onSelectTask}
          onOpenHitl={(h) => setHitlOpen(h)}
        />
      </div>

      {shipError && (
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--cream-hi, #faf6ec)',
            color: 'crimson',
            fontSize: 12,
            borderTop: '1.5px dashed var(--line-soft)',
          }}
        >
          {shipError}
        </div>
      )}

      <CrFooter
        variant="mobile"
        roster={roster}
        onSend={(p) => void handleSend(p)}
        promptValue={prompt}
        onChangePrompt={setPrompt}
        draftActive={!!draftId}
        mode={mode}
        onChangeMode={setMode}
        onCancelDraft={cancelDraft}
      />

      <div className="cr-scrim" onClick={closeDrawers} />
      <div className="cr-drawer left">
        <CrPartySidebar
          variant="mobile"
          roster={roster}
          tasks={tasks}
          onHire={() => {
            closeDrawers()
            setHireOpen(true)
          }}
        />
      </div>
      <div className="cr-drawer right">
        <CrEventFeed
          variant="mobile"
          recipeId={recipeId}
          focusTaskId={focusedTask?.taskId}
          focusAgentId={focusedTask?.agentId}
          onClose={() => {
            setFeedOpen(false)
            // Clear focus when the user dismisses the panel so the next
            // open shows the unfiltered feed unless they click another task.
            setFocusedTask(null)
          }}
        />
      </div>

      {accountId && (
        <HireAgentRuntimeModal
          open={hireOpen}
          onClose={() => setHireOpen(false)}
          accountId={accountId}
          onPaired={handlePaired}
          variant="mobile"
        />
      )}

      {hitlOpen && (
        <CrHITLPopout
          item={hitlOpen}
          task={tasks.find((t) => t.id === hitlOpen.taskId)}
          onClose={() => setHitlOpen(null)}
          onSubmit={(payload) => {
            if (payload.kind !== 'answer') {
              setHitlOpen(null)
              return
            }
            const taskId = hitlOpen.taskId
            // Optimistic close so the operator gets immediate feedback.
            setHitlOpen(null)
            postHitlAnswer(taskId, payload.text)
              .then(() => {
                showToast('Sent — task back to OPEN', 1800)
                // Force-refresh bundles so the SPA reflects the
                // new status without waiting for the next 6s tick.
                void refreshBundles()
              })
              .catch((e) => {
                const err = e as { message?: string; status?: number }
                showToast(
                  `HITL submit failed: ${err.message ?? err.status}`,
                  3000,
                )
              })
          }}
        />
      )}

      {/* Invocation Contract slice 5 — schema-driven elicit popout for
          new-style HITL invocations spawned by `delegate(to="human", ...)`.
          Auto-opens on first pending elicit; closes on submit/decline.
          Dispatches to CrAuthRequiredPopout when the elicit carries a
          structured `op: "auth_required"` from the brain (just-in-time
          credential bootstrap). */}
      {elicitOpen && elicitOpen.op === 'auth_required' ? (
        <CrAuthRequiredPopout
          item={elicitOpen}
          onClose={() => setElicitOpen(null)}
          onResolved={() => {
            setElicitOpen(null)
            showToast('Credential stored — agent resuming', 1800)
          }}
        />
      ) : elicitOpen && (
        <CrInvocationElicitPopout
          item={elicitOpen}
          onClose={() => setElicitOpen(null)}
          onSubmit={(envelope) => {
            const invocationId = elicitOpen.invocationId
            setElicitOpen(null)
            submitInvocationResult(invocationId, envelope)
              .then(() => {
                showToast('Sent — agent resuming', 1800)
              })
              .catch((e) => {
                const err = e as { message?: string; status?: number }
                showToast(
                  `Submit failed: ${err.message ?? err.status}`,
                  3000,
                )
              })
          }}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 96,
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'var(--ink)',
            color: 'var(--cream-hi)',
            fontFamily: 'Silkscreen,monospace',
            fontSize: 10,
            letterSpacing: 0.5,
            boxShadow: '3px 3px 0 var(--amber-deep)',
            zIndex: 250,
            pointerEvents: 'none',
            maxWidth: '88vw',
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

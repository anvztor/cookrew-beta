import { useCallback, useEffect, useState } from 'react'
import { CallbackScreen } from '../components/auth-view/callback-screen'
import { CrEventFeed } from '../components/event-feed'
import { CrFooter } from '../components/footer'
import { CrHeader } from '../components/header'
import { CrMissionBoard } from '../components/mission-board'
import { CrPartySidebar } from '../components/party-sidebar'
import { HireAgentRuntimeModal } from '../components/auth-view/hire-agent-runtime-modal'
import { CrHITLPopout } from '../components/hitl-popout'
import { redirectToLogin } from '../lib/auth/auth-client'
import { useAuth } from '../lib/auth/useAuth'
import {
  createBundle,
  createTask,
  getBundle,
  listBundles,
  listRuntimes,
  type Runtime,
  type Task as ApiTask,
} from '../lib/api/krewhub-client'
// Note: the in-process event-bus is intentionally NOT imported here.
// All on-screen events come from the krewhub recipe SSE stream
// (see CrEventFeed → useRecipeStream). Anything we'd emit here would
// be frontend narration, which is exactly what we removed.
import {
  runtimeToRoster,
  type RosterMember,
} from '../data/roster'
import { deriveHitl, type HitlItem, type Task, type TaskStatus } from '../data/tasks'
import type { Bundle } from '../components/bundle-tabs'
import type { Account } from '../lib/auth/auth-client'

const RECIPE_ID =
  (import.meta.env.VITE_KREWHUB_RECIPE_ID as string | undefined) ?? 'rec_fefc7a34'

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
      const agents = runtimes.map(runtimeToRoster)
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

  // ── 2. Bundle bootstrap: list bundles for the configured recipe ──
  // Real bundles only — no frontend-only `BUN_4A2C` placeholder.
  const refreshBundles = useCallback(async () => {
    try {
      const summaries = await listBundles(RECIPE_ID)
      const detailed = await Promise.all(
        summaries.map(async (b) => {
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
  }, [])

  useEffect(() => {
    if (state.status !== 'authed') return
    void refreshBundles()
  }, [state.status, refreshBundles])

  // Light polling (every 6s) of the active bundle so completed-status
  // updates from the daemon are visible without per-task SSE wiring.
  useEffect(() => {
    if (!activeBundleId) return
    const id = setInterval(async () => {
      try {
        const detail = await getBundle(activeBundleId)
        if (!detail) return
        setBundles((bs) =>
          bs.map((b) =>
            b.id !== activeBundleId
              ? b
              : {
                  ...b,
                  tasks: detail.tasks.map((t, i) => backendTaskToUi(t, i)),
                },
          ),
        )
      } catch {
        // transient errors — ignore; next tick will retry.
      }
    }, 6000)
    return () => clearInterval(id)
  }, [activeBundleId])

  // ── 3. Hire flow refreshes roster after pair ────────────────────
  const handlePaired = (runtimes: Runtime[]) => {
    if (state.status === 'authed') {
      const human = humanRosterFromAccount(state.account)
      setRoster([human, ...runtimes.map(runtimeToRoster)])
    }
    showToast(`Paired · ${runtimes.length} agent${runtimes.length === 1 ? '' : 's'} online`, 2400)
  }

  // ── 4. Bundle create (the "+ NEW" tab) — real POST ──────────────
  const addBundle = async () => {
    if (state.status !== 'authed') return
    try {
      const b = await createBundle(RECIPE_ID, 'New mission')
      setBundles((bs) => [...bs, { id: b.id, name: b.prompt ?? b.id, tasks: [] }])
      setActiveBundleId(b.id)
      setDraftId(null)
      setPrompt('')
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
  const addDraft = ({ x, y }: { x: number; y: number }) => {
    if (!activeBundleId) {
      showToast('Hire an agent or wait for a bundle to load first', 2400)
      return
    }
    const id = 'd' + Date.now()
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
  const shipReal = async (text: string): Promise<ApiTask | null> => {
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
      const err = e as { code?: string; message?: string }
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

  const onChangeDraftTitle = (v: string) => {
    setPrompt(v)
    setTasks((ts) => ts.map((t) => (t.id === draftId ? { ...t, title: v } : t)))
  }
  const onShipDraft = () => void handleSend({ mode, text: prompt })

  // ── Auth gate ───────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'anon' && window.location.pathname !== '/auth/callback') {
      void redirectToLogin()
    }
  }, [state.status])

  if (window.location.pathname === '/auth/callback') {
    return <CallbackScreen />
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
          onChangeDraftTitle={onChangeDraftTitle}
          onShipDraft={onShipDraft}
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
          recipeId={RECIPE_ID}
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
          onSubmit={() => {
            // No mock answer pipeline — just close. A future change can
            // POST the answer to a krewhub HITL endpoint.
            setHitlOpen(null)
            showToast('HITL answer flow not yet wired to backend', 2400)
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

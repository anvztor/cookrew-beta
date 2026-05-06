import { useCallback, useEffect, useRef, useState } from 'react'
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
import { createTask, listRuntimes, type Runtime } from '../lib/api/krewhub-client'
import { emitEvent } from '../lib/event-bus'
import {
  CR_ROSTER_INITIAL,
  runtimeToRoster,
  type RosterMember,
} from '../data/roster'
import {
  decomposeGoal,
  deriveHitl,
  MOCK_QUESTIONS,
  truncate,
  type HitlItem,
  type Task,
} from '../data/tasks'
import type { Bundle } from '../components/bundle-tabs'

const DEV_BUNDLE_ID =
  (import.meta.env.VITE_KREWHUB_DEV_BUNDLE_ID as string | undefined) ?? 'BUN_DEV1'

interface DesignBundle extends Bundle {
  id: string
}

const initialBundle = (): DesignBundle => ({
  id: 'BUN_4A2C',
  name: 'Heartbeat reliability sweep',
  tasks: [],
})

const MODES = ['orch', 'assign', 'ask'] as const
type ShipPayload = { mode: string; text: string }

function makeBundleId(): string {
  return 'BUN_' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

export function MobileApp() {
  const { state, logout } = useAuth()

  const [partyOpen, setPartyOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [hireOpen, setHireOpen] = useState(false)

  const [roster, setRoster] = useState<RosterMember[]>(CR_ROSTER_INITIAL)

  const [bundles, setBundles] = useState<DesignBundle[]>(() => [initialBundle()])
  const [activeBundleId, setActiveBundleId] = useState<string>(() => bundles[0].id)
  const activeBundle = bundles.find((b) => b.id === activeBundleId) ?? bundles[0]
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
  const [formatTick, setFormatTick] = useState(0)
  const [hitlOpen, setHitlOpen] = useState<HitlItem | null>(null)
  const [shipError, setShipError] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const showToast = (msg: string, ms = 1800) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  const onlineCount = roster.filter((r) => r.status !== 'off').length

  // ── Bundle ops ───────────────────────────────────────────────
  const addBundle = () => {
    const b: DesignBundle = { id: makeBundleId(), name: 'New mission', tasks: [] }
    setBundles((bs) => [...bs, b])
    setActiveBundleId(b.id)
    setDraftId(null)
    setPrompt('')
    emitEvent({ src: 'SYS', kind: 'bundle', msg: `>> BUNDLE ${b.id} CREATED · "${b.name}"` })
  }
  const closeBundle = (id: string) => {
    setBundles((bs) => {
      if (bs.length <= 1) return bs
      const next = bs.filter((b) => b.id !== id)
      if (id === activeBundleId) {
        const idx = bs.findIndex((b) => b.id === id)
        const pick = next[Math.max(0, idx - 1)] ?? next[0]
        setActiveBundleId(pick.id)
      }
      emitEvent({ src: 'SYS', kind: 'warn', msg: `!! BUNDLE ${id} CLOSED` })
      return next
    })
  }
  const renameBundle = (id: string, name: string) => {
    setBundles((bs) => bs.map((b) => (b.id === id ? { ...b, name } : b)))
  }

  // ── DAG auto-layout (depth columns + barycenter rows) ─────────
  const formatBoard = () => {
    setTasks((ts) => {
      if (ts.length === 0) return ts
      const PAD_X = 24
      const PAD_Y = 24
      const isMobileVP = window.innerWidth < 720
      const CARD_W = isMobileVP ? 180 : 220
      const CARD_H = isMobileVP ? 120 : 132
      const COL_GAP = 56
      const ROW_GAP = 24
      const COL_W = CARD_W + COL_GAP
      const ROW_H = CARD_H + ROW_GAP

      const byId: Record<string, Task> = Object.fromEntries(ts.map((t) => [t.id, t]))
      const depth: Record<string, number> = {}
      const visit = (id: string, stack: Set<string>): number => {
        if (depth[id] !== undefined) return depth[id]
        if (stack.has(id)) return 0
        stack.add(id)
        const deps = (byId[id]?.deps ?? []).filter((d) => byId[d])
        const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => visit(dep, stack)))
        stack.delete(id)
        depth[id] = d
        return d
      }
      ts.forEach((t) => visit(t.id, new Set()))

      const cols: Record<number, Task[]> = {}
      ts.forEach((t) => {
        const c = depth[t.id] || 0
        ;(cols[c] = cols[c] || []).push(t)
      })
      const depthKeys = Object.keys(cols).map(Number).sort((a, b) => a - b)

      const rowOf: Record<string, number> = {}
      cols[depthKeys[0]]?.sort((a, b) => String(a.no).localeCompare(String(b.no)))
      cols[depthKeys[0]]?.forEach((t, i) => {
        rowOf[t.id] = i
      })

      for (let k = 1; k < depthKeys.length; k++) {
        const list = cols[depthKeys[k]]
        const scored = list.map((t) => {
          const ps = (t.deps || []).filter((d) => rowOf[d] !== undefined)
          const score = ps.length
            ? ps.reduce((s, d) => s + rowOf[d], 0) / ps.length
            : Infinity
          return { t, score }
        })
        scored.sort((a, b) =>
          a.score - b.score || String(a.t.no).localeCompare(String(b.t.no)),
        )
        let nextSlot = 0
        scored.forEach(({ t, score }) => {
          const target = Number.isFinite(score) ? Math.round(score) : nextSlot
          const slot = Math.max(target, nextSlot)
          rowOf[t.id] = slot
          nextSlot = slot + 1
        })
      }

      const colMinRow: Record<number, number> = {}
      const colMaxRow: Record<number, number> = {}
      depthKeys.forEach((c) => {
        const rs = cols[c].map((t) => rowOf[t.id])
        colMinRow[c] = Math.min(...rs)
        colMaxRow[c] = Math.max(...rs)
      })
      const colSpans = depthKeys.map((c) => colMaxRow[c] - colMinRow[c])
      const globalRows = Math.max(...colSpans, 0)

      const next = ts.map((t) => ({ ...t }))
      const byNextId = Object.fromEntries(next.map((t) => [t.id, t]))

      depthKeys.forEach((c, i) => {
        const span = colSpans[i]
        const yOffset = ((globalRows - span) / 2) * ROW_H
        cols[c].forEach((t) => {
          const localRow = rowOf[t.id] - colMinRow[c]
          byNextId[t.id].x = PAD_X + i * COL_W
          byNextId[t.id].y = PAD_Y + yOffset + localRow * ROW_H
        })
      })

      return next
    })
    setFormatTick((n) => n + 1)
  }

  // ── OPEN → IN PROGRESS watcher ───────────────────────────────
  const openSig = tasks
    .filter((t) => t.status === 'open' && !t.blocked)
    .map((t) => t.id + ':' + (t.openedAt ?? 0))
    .join('|')
  const freeSig = roster
    .filter((r) => r.kind === 'agent' && r.status === 'on')
    .map((r) => r.id)
    .join('|')

  useEffect(() => {
    if (!openSig || !freeSig) return
    const open = tasks
      .filter((t) => t.status === 'open' && !t.blocked)
      .sort((a, b) => (a.openedAt ?? 0) - (b.openedAt ?? 0))
    const free = roster.find((r) => r.kind === 'agent' && r.status === 'on')
    if (!open.length || !free) return

    const oldest = open[0]
    const minOpenMs = 1500
    const elapsed = Date.now() - (oldest.openedAt ?? 0)
    const wait = Math.max(0, minOpenMs - elapsed)

    const timer = setTimeout(() => {
      setTasks((ts) => {
        const t = ts.find((x) => x.id === oldest.id)
        if (!t || t.status !== 'open') return ts
        return ts.map((x) =>
          x.id === oldest.id
            ? {
                ...x,
                status: 'working',
                assignee: free.name,
                role: (free.sub.split('·')[0] ?? '').trim().toUpperCase(),
                workingAt: Date.now(),
              }
            : x,
        )
      })
      setRoster((r) =>
        r.map((a) =>
          a.id === free.id
            ? {
                ...a,
                status: 'busy',
                used: Math.min(a.ctxMax, (a.used ?? 0) + 4200),
              }
            : a,
        ),
      )
      emitEvent({
        src: free.name.toUpperCase(),
        kind: 'claim',
        msg: `@${free.name.toLowerCase()} CLAIMED quest #${oldest.no} "${(oldest.title || '').slice(0, 42)}"`,
      })
      const fname = free.name.toUpperCase()
      const qno = oldest.no
      setTimeout(
        () =>
          emitEvent({
            src: fname,
            kind: 'tool',
            msg: `bash$ git checkout -b agent/${free.name.toLowerCase()}-q${qno}`,
          }),
        600,
      )
      setTimeout(
        () =>
          emitEvent({
            src: fname,
            kind: 'think',
            msg: `... reading repo · planning approach for #${qno}`,
          }),
        1500,
      )
      showToast(`${free.name} claimed quest #${oldest.no}`, 2200)
    }, wait)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSig, freeSig])

  // ── Working → done|blocked lifecycle ─────────────────────────
  const lifecycleRef = useRef<{ scheduled: Set<string> }>({ scheduled: new Set() })
  useEffect(() => {
    const sched = lifecycleRef.current
    tasks.forEach((t) => {
      if (t.status !== 'working') return
      if (t.hitl) return
      const key = t.id + ':' + (t.workingAt ?? 0)
      if (sched.scheduled.has(key)) return
      sched.scheduled.add(key)
      const wait = 4500 + Math.floor(Math.random() * 4500)
      const willBlock = Math.random() < 0.45
      setTimeout(() => {
        setTasks((ts) =>
          ts.map((x) => {
            if (x.id !== t.id || x.status !== 'working' || x.hitl) return x
            if (willBlock) {
              const Q = MOCK_QUESTIONS[Math.floor(Math.random() * MOCK_QUESTIONS.length)]
              emitEvent({
                src: (x.assignee || 'AGENT').toUpperCase(),
                kind: 'warn',
                msg: `⚠ #${x.no} BLOCKED · "${Q.slice(0, 56)}"`,
              })
              return {
                ...x,
                hitl: 'needs_input' as const,
                hitlPending: 'just now',
                hitlOverdue: false,
                hitlQuestion: Q,
                hitlAt: Date.now(),
              }
            }
            const adds = 8 + Math.floor(Math.random() * 60)
            const dels = Math.floor(Math.random() * 24)
            emitEvent({
              src: (x.assignee || 'AGENT').toUpperCase(),
              kind: 'code',
              msg: `ƒ PUSH #${x.no} · +${adds}/−${dels}`,
            })
            emitEvent({
              src: (x.assignee || 'AGENT').toUpperCase(),
              kind: 'done',
              msg: `✓ QUEST #${x.no} CLEARED`,
            })
            setTimeout(() => {
              setRoster((r) =>
                r.map((a) =>
                  a.name &&
                  a.name.toUpperCase() === (x.assignee || '').toUpperCase() &&
                  a.status === 'busy'
                    ? { ...a, status: 'on' }
                    : a,
                ),
              )
            }, 0)
            return { ...x, status: 'done' as const, adds, dels }
          }),
        )
      }, wait)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  // ── HITL pending-time ticker ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTasks((ts) =>
        ts.map((t) => {
          if (!t.hitl || !t.hitlAt) return t
          const sec = Math.round((Date.now() - t.hitlAt) / 1000)
          const label =
            sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`
          const overdue = sec >= 90
          if (t.hitlPending === label && t.hitlOverdue === overdue) return t
          return { ...t, hitlPending: label, hitlOverdue: overdue }
        }),
      )
    }, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Boot announcement ────────────────────────────────────────
  useEffect(() => {
    emitEvent({
      src: 'SYS',
      kind: 'bundle',
      msg: `>> BUNDLE ${activeBundleId} OPENED · "${activeBundle?.name ?? ''}" · empty board`,
    })
    emitEvent({ src: 'SYS', kind: 'bundle', msg: '>> SSE channel attached · krewhub feed live' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Roster sync from krewhub ────────────────────────────────
  // Replace any prior agent rows with a fresh projection of the user's
  // krewhub agent_runtimes — keeps the human operator at the top.
  const applyRuntimes = useCallback((runtimes: Runtime[]) => {
    setRoster((prev) => {
      const human = prev.find((m) => m.kind === 'human') ?? CR_ROSTER_INITIAL[0]
      const agents = runtimes.map(runtimeToRoster)
      return [human, ...agents]
    })
  }, [])

  // Initial roster fetch — runs once we know the user's account_id.
  const accountId =
    state.status === 'authed' ? state.account.account_id : undefined
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    void (async () => {
      try {
        const runtimes = await listRuntimes(accountId)
        if (cancelled) return
        applyRuntimes(runtimes)
        if (runtimes.length > 0) {
          emitEvent({
            src: 'SYS',
            kind: 'bundle',
            msg: `>> ROSTER LOADED · ${runtimes.length} paired agent(s)`,
          })
        }
      } catch (e) {
        if (cancelled) return
        const err = e as { message?: string }
        emitEvent({
          src: 'SYS',
          kind: 'warn',
          msg: `!! roster fetch failed: ${err.message ?? 'unknown'}`,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accountId, applyRuntimes])

  // Called by HireAgentRuntimeModal after a successful pair.
  const handlePaired = (runtimes: Runtime[]) => {
    applyRuntimes(runtimes)
    runtimes.forEach((rt) => {
      const r = runtimeToRoster(rt)
      emitEvent({
        src: 'SYS',
        kind: 'bundle',
        msg: `>> AGENT ${r.name} ONLINE · ${r.sub} · ${rt.id}`,
      })
    })
    showToast(`Paired · ${runtimes.length} agent${runtimes.length === 1 ? '' : 's'} online`, 2400)
  }

  // ── Live-bind prompt → draft title ───────────────────────────
  useEffect(() => {
    if (!draftId) return
    setTasks((ts) => ts.map((t) => (t.id === draftId ? { ...t, title: prompt } : t)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, draftId])

  // ── Drafts ──────────────────────────────────────────────────
  const addDraft = ({ x, y }: { x: number; y: number }) => {
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
    emitEvent({ src: 'ALEX', kind: 'prompt', msg: `▸ DRAFT #${no} created · awaiting spec` })
  }
  const cancelDraft = useCallback(() => {
    if (!draftId) return
    setTasks((ts) => ts.filter((t) => t.id !== draftId))
    setDraftId(null)
    setPrompt('')
    setMode('orch')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])

  // ESC cancels active draft
  useEffect(() => {
    if (!draftId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDraft()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draftId, cancelDraft])

  // Tab cycles modes
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

  // Cycle-safe link
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
      showToast(`Linked #${src.no} → #${tgt.no}`, 1600)
      return ts.map((t) => (t.id === tgtId ? { ...t, deps: [...existing, srcId] } : t))
    })
  }

  // ── ORCH flow ───────────────────────────────────────────────
  const runOrch = (goal: string) => {
    const id = 'orch_' + Date.now()
    const no = String(tasks.length + 1).padStart(2, '0')
    const vp = document.querySelector('[data-cr-canvas]')
    const VW = vp ? (vp as HTMLElement).clientWidth : 900
    const orchX = Math.max(40, VW - 280)
    const orchY = 40
    const orchTask: Task = {
      id,
      no,
      title: goal,
      status: 'orch',
      assignee: 'PLANNER',
      role: 'ORCH',
      adds: 0,
      dels: 0,
      x: orchX,
      y: orchY,
      orchPhase: 'thinking',
      orchLog: [],
      bundleCount: 0,
    }
    setTasks((ts) => [...ts, orchTask])
    emitEvent({ src: 'PLANNER', kind: 'think', msg: `▸ orchestrating: "${goal.slice(0, 48)}"` })

    const subs = decomposeGoal(goal)
    const lines = [
      { text: `parsing goal: "${truncate(goal, 36)}"`, tone: 'dim' as const },
      { text: 'walking repo · krewcli/* · server/*', tone: 'dim' as const },
      { text: 'identifying dependencies …', tone: 'dim' as const },
      { text: `decomposing into ${subs.length} quests`, tone: 'hi' as const },
    ]
    lines.forEach((ln, i) => {
      setTimeout(() => {
        setTasks((ts) =>
          ts.map((t) =>
            t.id === id ? { ...t, orchLog: [...(t.orchLog || []), ln] } : t,
          ),
        )
        emitEvent({
          src: 'PLANNER',
          kind: ln.tone === 'hi' ? 'milestone' : 'think',
          msg: ln.text,
        })
      }, 500 + i * 700)
    })

    const spawnAt = 500 + lines.length * 700 + 400
    setTimeout(() => {
      setTasks((ts) => {
        const without = ts.filter((t) => t.id !== id)
        const baseX = orchX
        const newTasks: Task[] = subs.map((sub, i) => {
          const childId = `${id}_c${i}`
          const childNo = String(without.length + 1 + i).padStart(2, '0')
          const deps = i > 0 ? [`${id}_c${i - 1}`] : []
          return {
            id: childId,
            no: childNo,
            title: sub,
            status: 'draft',
            assignee: '—',
            role: '—',
            adds: 0,
            dels: 0,
            x: baseX + i * 240,
            y: orchY,
            deps,
          }
        })
        return [...without, ...newTasks]
      })
      emitEvent({
        src: 'SYS',
        kind: 'bundle',
        msg: `>> BUNDLE EXPANDED · ${subs.length} draft quests linked`,
      })
      setTimeout(() => formatBoard(), 50)
      showToast(`Orch · spawned ${subs.length} draft quests`, 2400)
    }, spawnAt)
  }

  // ── Send / ship ─────────────────────────────────────────────
  const tryRealCreateTask = async (title: string) => {
    if (state.status !== 'authed') return
    try {
      const { task } = await createTask(DEV_BUNDLE_ID, title)
      setActiveTaskId(task.id)
      setShipError(null)
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'no_paired_agent') {
        // Soft-fail: let the design's mock lifecycle continue.
        return
      }
      setShipError(err.message ?? 'Failed to ship')
    }
  }

  const handleSend = ({ text }: ShipPayload) => {
    if (!text.trim()) return
    if (draftId) {
      const tid = draftId
      const now = Date.now()
      const draft = tasks.find((t) => t.id === tid)
      const qno = draft ? draft.no : '??'
      setTasks((ts) =>
        ts.map((t) =>
          t.id === tid
            ? {
                ...t,
                title: text.trim(),
                status: 'open' as const,
                assignee: '—',
                role: '—',
                adds: 0,
                dels: 0,
                openedAt: now,
              }
            : t,
        ),
      )
      emitEvent({
        src: 'SYS',
        kind: 'bundle',
        msg: `>> QUEST #${qno} SHIPPED · "${text.trim().slice(0, 50)}" · awaiting claim`,
      })
      showToast('Quest opened — awaiting agent…', 1800)
      setDraftId(null)
      setPrompt('')
      void tryRealCreateTask(text.trim())
    } else if (mode === 'orch') {
      runOrch(text.trim())
      setPrompt('')
    } else {
      setPrompt('')
      showToast('Tip: double-click the board to draft a quest first', 2400)
    }
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
    }
  }

  const onChangeDraftTitle = (v: string) => {
    setPrompt(v)
    setTasks((ts) => ts.map((t) => (t.id === draftId ? { ...t, title: v } : t)))
  }

  const onShipDraft = () => handleSend({ mode, text: prompt })

  // ── Auth gate ───────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────
  const closeDrawers = () => {
    setPartyOpen(false)
    setFeedOpen(false)
  }
  const cls = `cr cr-app${partyOpen ? ' party-open' : ''}${feedOpen ? ' feed-open' : ''}`
  const liveHitl = deriveHitl(tasks)

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
          bundles={bundles}
          activeBundleId={activeBundleId}
          onSelectBundle={setActiveBundleId}
          onAddBundle={addBundle}
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
        onSend={handleSend}
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
          taskId={activeTaskId ?? undefined}
          onClose={() => setFeedOpen(false)}
        />
      </div>

      {accountId && (
        <HireAgentRuntimeModal
          open={hireOpen}
          onClose={() => setHireOpen(false)}
          bundleId={DEV_BUNDLE_ID}
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
            const tid = hitlOpen.taskId
            const tnow = tasks.find((t) => t.id === tid)
            if (payload.kind === 'answer') {
              setTasks((ts) =>
                ts.map((t) =>
                  t.id === tid
                    ? {
                        ...t,
                        status: 'open',
                        assignee: '—',
                        role: '—',
                        hitl: undefined,
                        hitlPending: undefined,
                        hitlQuestion: undefined,
                        hitlAt: undefined,
                        hitlOverdue: undefined,
                        workingAt: undefined,
                      }
                    : t,
                ),
              )
              if (tnow && tnow.assignee && tnow.assignee !== '—') {
                setRoster((r) =>
                  r.map((a) =>
                    a.name &&
                    a.name.toUpperCase() === tnow.assignee.toUpperCase() &&
                    a.status === 'busy'
                      ? { ...a, status: 'on' }
                      : a,
                  ),
                )
              }
              emitEvent({
                src: 'ALEX',
                kind: 'prompt',
                msg: `▸ HUMAN ANSWERED #${tnow?.no ?? '??'} · returning to OPEN`,
              })
              showToast('▸ Sent · #' + (tnow?.no ?? '') + ' returned to OPEN', 2000)
            } else {
              emitEvent({ src: 'ALEX', kind: 'warn', msg: `⏸ HOLD #${tnow?.no ?? '??'}` })
              showToast('⏸ Holding', 2000)
            }
            setHitlOpen(null)
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

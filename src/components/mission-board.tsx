// CrMissionBoard — bundle tabs + infinite pan/zoom DAG canvas + HITL bar.
// Cards render via CrTaskLiveCard with per-status styling: draft, open,
// working, blocked, done, cooked, orch.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { CrChip, CrLED } from './atoms/atoms'
import { FeedDot } from './atoms/feed-dot'
import { CR_STATUS, type HitlItem, type Task } from '../data/tasks'
import type { Variant } from './party-sidebar'
import { CrBundleTabs, type Bundle } from './bundle-tabs'
import { getTaskLastHumanInput } from '../lib/api/krewhub-client'

interface CrTaskLiveCardProps {
  t: Task
  compact?: boolean
  highlight?: boolean
  hitlFocus?: boolean
  onClick?: () => void
  onShowFeed?: () => void
  style?: CSSProperties
  dragging?: boolean
}

export function CrTaskLiveCard({
  t,
  compact = false,
  highlight = false,
  hitlFocus = false,
  onClick,
  onShowFeed,
  style,
  dragging,
}: CrTaskLiveCardProps) {
  const isDraft = t.status === 'draft'
  const isOrch = t.status === 'orch'
  const isBlocked = !!t.blocked || t.hitl === 'needs_input'
  const isCooked = t.status === 'cooked'
  const isOpen = t.status === 'open' && !isBlocked
  const isWorking = t.status === 'working' && !isBlocked && !isCooked

  const st = CR_STATUS[isCooked ? 'cooked' : isBlocked ? 'blocked' : t.status]

  // Latest operator instruction for this task — task.title is the
  // initial bundle prompt, so only override it when a follow-up
  // exists. Lazy per-card fetch is fine: ~10 tiles per bundle and the
  // endpoint is a single indexed lookup.
  const [followup, setFollowup] = useState<string | null>(null)
  useEffect(() => {
    if (isDraft || !t.id) return
    let cancelled = false
    void (async () => {
      try {
        const r = await getTaskLastHumanInput(t.id)
        if (!cancelled && r.kind === 'human_followup' && r.text.trim()) {
          setFollowup(r.text)
        }
      } catch {
        // ignore — fall back to task.title
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.id, isDraft])

  if (isOrch) {
    const phase = t.orchPhase || 'thinking'
    const lines = t.orchLog || []
    return (
      <div
        onClick={onClick}
        className="cr-phos cr-crt"
        style={{
          padding: compact ? '8px 10px' : '10px 12px',
          cursor: dragging ? 'grabbing' : onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: '100%',
          outline: highlight ? '2px solid var(--amber-deep)' : 'none',
          outlineOffset: 1,
          fontFamily: 'VT323,monospace',
          ...style,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="cr-phos-hi"
              style={{
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              #{t.no}
            </span>
            <span className="cr-led busy" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              className="cr-phos-hi"
              style={{
                fontFamily: 'Silkscreen,monospace',
                fontSize: 7,
                letterSpacing: 0.6,
                border: '1.5px solid var(--phos-dim)',
                padding: '1px 5px',
                background: 'rgba(233,185,73,0.08)',
              }}
            >
              ORCH · {phase.toUpperCase()}
            </span>
            {onShowFeed && <FeedDot tone="phos" onClick={() => onShowFeed()} />}
          </div>
        </div>
        <div
          className="cr-phos-hi"
          style={{
            fontFamily: 'Silkscreen,monospace',
            fontSize: compact ? 11 : 12,
            letterSpacing: 0.5,
            lineHeight: 1.25,
          }}
        >
          {t.title || 'orchestrating…'}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.25,
            minHeight: compact ? 50 : 64,
            color: 'var(--phos)',
          }}
        >
          {lines.map((ln, i) => (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <span className="cr-phos-dim">{'>'}</span>
              <span style={{ color: ln.tone === 'hi' ? 'var(--phos-glow)' : 'var(--phos)' }}>
                {ln.text}
              </span>
            </div>
          ))}
          {phase !== 'done' && (
            <span className="cr-phos-hi">
              <span style={{ animation: 'cr-blink 0.7s step-end infinite' }}>▮</span>
            </span>
          )}
        </div>
        {phase === 'done' && (t.bundleCount ?? 0) > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingTop: 4,
              borderTop: '1px dashed var(--phos-dim)',
              fontFamily: 'Silkscreen,monospace',
              fontSize: 8,
              letterSpacing: 0.6,
            }}
          >
            <span className="cr-phos-hi">▶ SPAWNED</span>
            <span className="cr-phos">{t.bundleCount} QUESTS</span>
          </div>
        )}
      </div>
    )
  }

  const cardBg = isDraft
    ? 'rgba(255,255,255,0.6)'
    : isCooked
      ? '#E8FAEF'
      : isBlocked
        ? '#FEF2F2'
        : isOpen
          ? '#F4F8FF'
          : isWorking
            ? '#FFFBE5'
            : 'var(--cream-hi)'

  const cardBorder = isDraft
    ? '2px dashed var(--ink-soft)'
    : isCooked
      ? '2px solid #0B4F2E'
      : isBlocked
        ? '2px solid #DC2626'
        : isOpen
          ? '2px solid #1E3A8A'
          : isWorking
            ? '2px solid #5C4A1F'
            : undefined

  const cardShadow = dragging
    ? '6px 6px 0 rgba(0,0,0,0.25)'
    : isDraft
      ? 'none'
      : isCooked
        ? '3px 3px 0 #0B4F2E'
        : isBlocked
          ? '3px 3px 0 #DC2626'
          : isOpen
            ? '3px 3px 0 #1E3A8A'
            : isWorking
              ? '3px 3px 0 #5C4A1F'
              : undefined

  return (
    <div
      onClick={onClick}
      className={isDraft ? '' : 'cr-bevel'}
      style={{
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: dragging ? 'grabbing' : onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 5 : 8,
        background: cardBg,
        border: cardBorder,
        width: '100%',
        outline: hitlFocus
          ? '3px solid var(--amber-deep)'
          : highlight
            ? '2px solid var(--amber-deep)'
            : 'none',
        outlineOffset: hitlFocus ? 3 : 1,
        boxShadow: cardShadow,
        animation: isDraft
          ? 'cr-draft-pulse 1.6s ease-in-out infinite'
          : hitlFocus
            ? 'cr-draft-pulse 1.2s ease-in-out infinite'
            : undefined,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="cr-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            #{t.no}
          </span>
          <CrLED
            state={
              isCooked
                ? 'on'
                : isBlocked
                  ? 'red'
                  : t.status === 'done'
                    ? 'on'
                    : t.status === 'working'
                      ? 'busy'
                      : t.status === 'open'
                        ? 'blue'
                        : 'off'
            }
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CrChip
            style={{
              background: st.bg,
              color: st.ink,
              borderColor: isDraft ? 'var(--ink-soft)' : 'var(--line)',
              borderStyle: isDraft ? 'dashed' : 'solid',
              fontSize: 7,
            }}
          >
            {st.label}
          </CrChip>
          {onShowFeed && !isDraft && (
            <FeedDot
              tone={isBlocked ? 'rose' : isCooked ? 'ink' : 'ink'}
              onClick={() => onShowFeed()}
            />
          )}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'Inter,sans-serif',
          fontSize: compact ? 13 : 14,
          fontWeight: 600,
          color: isDraft && !t.title ? 'var(--muted)' : 'var(--ink)',
          fontStyle: isDraft && !t.title ? 'italic' : 'normal',
          lineHeight: 1.3,
          minHeight: compact ? 16 : 18,
        }}
      >
        {t.title || (isDraft ? 'New quest' : '')}
      </div>
      {followup && (
        <div
          className="cr-mono"
          style={{
            display: 'flex',
            gap: 4,
            fontSize: 10,
            color: 'var(--ink-soft)',
            background: 'rgba(56,189,248,0.06)',
            border: '1px dashed rgba(56,189,248,0.35)',
            padding: '3px 6px',
            lineHeight: 1.35,
            maxHeight: 36,
            overflow: 'hidden',
          }}
          title={followup}
        >
          <span style={{ color: '#0369A1', fontWeight: 700 }}>&gt;</span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {followup}
          </span>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          paddingTop: 6,
          borderTop: '1.5px dashed var(--line-soft)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            flexWrap: 'wrap',
            rowGap: 2,
          }}
        >
          {isDraft ? (
            <span className="cr-kicker" style={{ fontSize: 8, color: 'var(--amber-deep)' }}>
              ▸ BOUND TO PROMPT
            </span>
          ) : isCooked ? (
            <>
              <span
                className="cr-led"
                style={{
                  width: 8,
                  height: 8,
                  flexShrink: 0,
                  background: '#10B981',
                  boxShadow: '0 0 4px #10B981',
                }}
              />
              <span className="cr-display" style={{ fontSize: 9, color: '#0B4F2E', flexShrink: 0 }}>
                ◉ NEEDS APPROVAL
              </span>
              <span
                className="cr-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                · {t.assignee}
              </span>
            </>
          ) : isBlocked ? (
            <>
              <span className="cr-led red" style={{ width: 8, height: 8, flexShrink: 0 }} />
              <span className="cr-display" style={{ fontSize: 9, color: '#DC2626', flexShrink: 0 }}>
                ◉ NEEDS INPUT
              </span>
              <span
                className="cr-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                · {t.assignee}
              </span>
            </>
          ) : isOpen ? (
            <>
              <span className="cr-display" style={{ fontSize: 9, color: '#1E3A8A', flexShrink: 0 }}>
                ◇ UNCLAIMED
              </span>
              <span
                className="cr-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                awaiting agent…
              </span>
            </>
          ) : isWorking ? (
            <>
              <span className="cr-led busy" style={{ width: 8, height: 8, flexShrink: 0 }} />
              <span className="cr-display" style={{ fontSize: 9, color: '#5C4A1F', flexShrink: 0 }}>
                ▸ {t.assignee}
              </span>
              <span
                className="cr-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                working…
              </span>
            </>
          ) : (
            <>
              <CrChip tone="slate" style={{ fontSize: 7 }}>
                {t.assignee}
              </CrChip>
              <span
                className="cr-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.role}
              </span>
            </>
          )}
        </div>
        {!isDraft && (t.adds > 0 || t.dels > 0) && (
          <div className="cr-mono" style={{ fontSize: 10, display: 'flex', gap: 5, flexShrink: 0 }}>
            <span style={{ color: 'var(--emerald)' }}>+{t.adds}</span>
            <span style={{ color: 'var(--rose)' }}>−{t.dels}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface CrTaskCanvasProps {
  tasks: Task[]
  variant?: Variant
  onSelect?: (t: Task) => void
  onShowFeed?: (t: Task) => void
  onDoubleClickCanvas?: (point: { x: number; y: number }) => void
  draftId?: string | null
  onLinkTasks?: (srcId: string, tgtId: string) => void
  formatTick?: number
  hitlFocusTaskId?: string | null
}

interface CardPos {
  x: number
  y: number
}

const Z_MIN = 0.15
const Z_MAX = 1.6

export function CrTaskCanvas({
  tasks,
  variant = 'desktop',
  onSelect,
  onShowFeed,
  onDoubleClickCanvas,
  draftId,
  onLinkTasks,
  formatTick = 0,
  hitlFocusTaskId,
}: CrTaskCanvasProps) {
  const [pos, setPos] = useState<Record<string, CardPos>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, { x: t.x, y: t.y }])),
  )
  const posRef = useRef(pos)
  useEffect(() => {
    posRef.current = pos
  }, [pos])
  const tasksRef = useRef(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const [pan, setPan] = useState<CardPos>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const [shiftDown, setShiftDown] = useState(false)
  const [linkSrc, setLinkSrc] = useState<{ id: string } | null>(null)
  const [linkCursor, setLinkCursor] = useState<CardPos | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const vpRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    id: string
    x: number
    y: number
    ox: number
    oy: number
    moved: boolean
    target: HTMLDivElement
    pid: number
  } | null>(null)
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const linkRef = useRef<{ srcId: string; pid: number } | null>(null)

  // Shift-key tracking for link mode
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftDown(false)
        if (linkRef.current) {
          linkRef.current = null
          setLinkSrc(null)
          setLinkCursor(null)
        }
      }
      if (e.key === 'Escape') {
        linkRef.current = null
        setLinkSrc(null)
        setLinkCursor(null)
      }
    }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Sync new tasks into pos map
  useEffect(() => {
    setPos((prev) => {
      const next = { ...prev }
      let changed = false
      tasks.forEach((t) => {
        if (!next[t.id]) {
          next[t.id] = { x: t.x, y: t.y }
          changed = true
        }
      })
      const ids = new Set(tasks.map((t) => t.id))
      Object.keys(next).forEach((k) => {
        if (!ids.has(k)) {
          delete next[k]
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [tasks])

  // Format / re-layout — snap positions to authoritative t.x/t.y on tick.
  useEffect(() => {
    if (!formatTick) return
    setPos(Object.fromEntries(tasks.map((t) => [t.id, { x: t.x, y: t.y }])))
  }, [formatTick, tasks])

  const isMobile = variant === 'mobile'
  const CARD_W = isMobile ? 180 : 220
  const CARD_H = isMobile ? 120 : 132

  const toCanvas = useCallback(
    (clientX: number, clientY: number): CardPos => {
      const rect = vpRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      }
    },
    [pan.x, pan.y, zoom],
  )

  const zoomAt = useCallback(
    (nextZoom: number, anchorClientX?: number, anchorClientY?: number) => {
      const rect = vpRef.current?.getBoundingClientRect()
      if (!rect) return
      const z2 = Math.max(Z_MIN, Math.min(Z_MAX, nextZoom))
      setZoom((prevZ) => {
        if (z2 === prevZ) return prevZ
        const ax =
          anchorClientX != null ? anchorClientX - rect.left : rect.width / 2
        const ay =
          anchorClientY != null ? anchorClientY - rect.top : rect.height / 2
        setPan((prevPan) => {
          const cx = (ax - prevPan.x) / prevZ
          const cy = (ay - prevPan.y) / prevZ
          return { x: ax - cx * z2, y: ay - cy * z2 }
        })
        return z2
      })
    },
    [],
  )

  const resetView = () => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const fitAll = useCallback(() => {
    const cw = isMobile ? 180 : 220
    const ch = isMobile ? 120 : 132
    const liveTasks = tasksRef.current
    const livePos = posRef.current
    const xs = liveTasks.map((t) => livePos[t.id]?.x ?? t.x)
    const ys = liveTasks.map((t) => livePos[t.id]?.y ?? t.y)
    const rect = vpRef.current?.getBoundingClientRect()
    if (!rect) return
    if (!xs.length) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
      return
    }
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs) + cw
    const maxY = Math.max(...ys) + ch
    const bw = maxX - minX
    const bh = maxY - minY
    const PAD = 32
    const VW = Math.max(100, rect.width - PAD * 2)
    const VH = Math.max(100, rect.height - PAD * 2)
    const fit = Math.min(VW / bw, VH / bh, 1)
    const z = Math.max(Z_MIN, Math.min(Z_MAX, fit))
    const px = (rect.width - bw * z) / 2 - minX * z
    const py = (rect.height - bh * z) / 2 - minY * z
    setZoom(z)
    setPan({ x: px, y: py })
  }, [isMobile])

  // Native non-passive wheel listener — preventDefault works only off React's
  // synthetic passive wheel handler.
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomAt(zoom * (1 - e.deltaY * 0.0015 * 4), e.clientX, e.clientY)
      } else {
        e.preventDefault()
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, zoomAt])

  const onVPDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-task-card]')) return
    if ((e.target as HTMLElement).closest('button, [data-cr-hud]')) return
    if (e.button !== 0 && e.button !== 1) return
    if (e.shiftKey) return
    e.preventDefault()
    panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    vpRef.current?.setPointerCapture(e.pointerId)
  }
  const onVPMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (linkRef.current) {
      const c = toCanvas(e.clientX, e.clientY)
      setLinkCursor(c)
      return
    }
    if (!panRef.current) return
    setPan({
      x: panRef.current.px + (e.clientX - panRef.current.x),
      y: panRef.current.py + (e.clientY - panRef.current.y),
    })
  }
  const onVPUp = () => {
    panRef.current = null
    if (linkRef.current) {
      linkRef.current = null
      setLinkSrc(null)
      setLinkCursor(null)
    }
  }

  const onCardDown = (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0) return
    // Suppress pointerdown’s default focus-shift so dragging a card
    // does not blur the MissionComposer input. Matches onVPDown.
    e.preventDefault()
    const cur = pos[id]
    if (!cur) return
    if (e.shiftKey) {
      linkRef.current = { srcId: id, pid: e.pointerId }
      setLinkSrc({ id })
      const c = toCanvas(e.clientX, e.clientY)
      setLinkCursor(c)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      return
    }
    dragRef.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      ox: cur.x,
      oy: cur.y,
      moved: false,
      target: e.currentTarget,
      pid: e.pointerId,
    }
  }
  const onCardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (linkRef.current) {
      const c = toCanvas(e.clientX, e.clientY)
      setLinkCursor(c)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const card = el?.closest?.('[data-task-card]') as HTMLElement | null
      const tgt = card?.getAttribute('data-id')
      setHoverId(tgt && tgt !== linkRef.current.srcId ? tgt : null)
      return
    }
    if (!dragRef.current) return
    const d = dragRef.current
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true
      setDraggingId(d.id)
      try {
        d.target.setPointerCapture(d.pid)
      } catch {
        // ignore
      }
    }
    if (d.moved) {
      setPos((p) => ({ ...p, [d.id]: { x: d.ox + dx, y: d.oy + dy } }))
    }
  }
  const onCardUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (linkRef.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const card = el?.closest?.('[data-task-card]') as HTMLElement | null
      const tgtId = card?.getAttribute('data-id') ?? null
      const srcId = linkRef.current.srcId
      if (tgtId && tgtId !== srcId) {
        onLinkTasks?.(srcId, tgtId)
      }
      linkRef.current = null
      setLinkSrc(null)
      setLinkCursor(null)
      return
    }
    dragRef.current = null
    setDraggingId(null)
  }
  const onCardEnter = (id: string) => {
    if (linkRef.current && linkRef.current.srcId !== id) setHoverId(id)
  }
  const onCardLeave = (id: string) => {
    setHoverId((h) => (h === id ? null : h))
  }

  const xs = Object.values(pos).map((p) => p.x)
  const ys = Object.values(pos).map((p) => p.y)
  const W = (xs.length ? Math.max(...xs) : 0) + CARD_W + 200
  const H = (ys.length ? Math.max(...ys) : 0) + CARD_H + 200

  const taskById: Record<string, Task> = Object.fromEntries(tasks.map((t) => [t.id, t]))

  return (
    <div
      ref={vpRef}
      className="cr"
      data-cr-canvas
      onPointerDown={onVPDown}
      onPointerMove={onVPMove}
      onPointerUp={onVPUp}
      onPointerCancel={onVPUp}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-task-card]')) return
        const c = toCanvas(e.clientX, e.clientY)
        const x = c.x - CARD_W / 2
        const y = c.y - CARD_H / 2
        onDoubleClickCanvas?.({ x: Math.max(20, x), y: Math.max(20, y) })
      }}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--cream-md)',
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)',
        backgroundSize: `${12 * zoom}px ${12 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: panRef.current ? 'grabbing' : 'grab',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: pan.x,
          top: pan.y,
          width: W,
          height: H,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
        >
          <defs>
            <marker
              id="cr-arrow-amber"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#D97706" />
            </marker>
            <marker
              id="cr-arrow-rose"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#DC2626" />
            </marker>
            <marker
              id="cr-arrow-live"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#5C4A1F" />
            </marker>
          </defs>
          {tasks.flatMap((t) =>
            (t.deps || []).map((dep) => {
              const srcTask = taskById[dep]
              if (!srcTask) return null
              const a = pos[dep]
              const b = pos[t.id]
              if (!a || !b) return null
              const ax = a.x + CARD_W
              const ay = a.y + CARD_H / 2
              const bx = b.x
              const by = b.y + CARD_H / 2
              const cx = (ax + bx) / 2
              const isBlocked = !!t.blocked
              const stroke = isBlocked ? '#DC2626' : '#D97706'
              const marker = isBlocked ? 'url(#cr-arrow-rose)' : 'url(#cr-arrow-amber)'
              return (
                <g key={t.id + dep}>
                  <path
                    d={`M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}`}
                    stroke={stroke}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 3"
                    opacity="0.85"
                    markerEnd={marker}
                  />
                  <circle cx={ax} cy={ay} r="3" fill={stroke} />
                </g>
              )
            }),
          )}
          {linkSrc && linkCursor && pos[linkSrc.id] && (() => {
            const a = pos[linkSrc.id]
            const ax = a.x + CARD_W
            const ay = a.y + CARD_H / 2
            let bx = linkCursor.x
            let by = linkCursor.y
            if (hoverId && pos[hoverId]) {
              const b = pos[hoverId]
              bx = b.x
              by = b.y + CARD_H / 2
            }
            const cx = (ax + bx) / 2
            return (
              <g>
                <path
                  d={`M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}`}
                  stroke="#5C4A1F"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray={hoverId ? '0' : '6 4'}
                  opacity="0.95"
                  markerEnd="url(#cr-arrow-live)"
                />
                <circle cx={ax} cy={ay} r="4" fill="#5C4A1F" />
              </g>
            )
          })()}
        </svg>
        {tasks.map((t) => {
          const p = pos[t.id]
          if (!p) return null
          return (
            <div
              key={t.id}
              data-task-card
              data-id={t.id}
              onPointerDown={(e) => onCardDown(t.id, e)}
              onPointerMove={onCardMove}
              onPointerUp={onCardUp}
              onPointerCancel={onCardUp}
              onPointerEnter={() => onCardEnter(t.id)}
              onPointerLeave={() => onCardLeave(t.id)}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: CARD_W,
                zIndex: draggingId === t.id ? 10 : 1,
                touchAction: 'none',
                cursor: shiftDown ? 'crosshair' : undefined,
                outline:
                  linkSrc && linkSrc.id === t.id
                    ? '2px dashed #5C4A1F'
                    : linkSrc && hoverId === t.id
                      ? '3px solid #5C4A1F'
                      : 'none',
                outlineOffset: 2,
                transition: 'outline 80ms',
              }}
            >
              <CrTaskLiveCard
                t={t}
                compact={isMobile}
                dragging={draggingId === t.id}
                highlight={t.id === draftId}
                hitlFocus={t.id === hitlFocusTaskId}
                onClick={() => onSelect?.(t)}
                onShowFeed={onShowFeed ? () => onShowFeed(t) : undefined}
              />
            </div>
          )
        })}
      </div>

      {tasks.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              border: '2px dashed var(--line-soft)',
              padding: '24px 28px',
              background: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div className="cr-display" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              EMPTY MISSION BOARD
            </div>
            <div
              className="cr-mono"
              style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}
            >
              Double-click anywhere to drop a new quest card and bind it to the prompt below.
            </div>
          </div>
        </div>
      )}

      <div
        className="cr-mono"
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 9,
          color: 'var(--muted)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        double-click to add · drag bg to pan ·{' '}
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>shift-drag</span> to link ·{' '}
        <span style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>⌘ wheel</span> to zoom
      </div>

      <div
        data-cr-hud
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          display: 'flex',
          gap: 4,
          zIndex: 25,
          fontFamily: 'Silkscreen,monospace',
          fontSize: 10,
          letterSpacing: 0.4,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            zoomAt(zoom / 1.2)
          }}
          title="zoom out"
          className="cr-bevel"
          style={{
            background: 'var(--cream-hi)',
            padding: '5px 9px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'var(--ink)',
            opacity: zoom <= Z_MIN + 0.001 ? 0.5 : 1,
          }}
        >
          −
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            resetView()
          }}
          title="reset zoom and pan"
          className="cr-bevel"
          style={{
            background: 'var(--ink)',
            color: 'var(--amber)',
            padding: '5px 9px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            minWidth: 50,
            textAlign: 'center',
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            zoomAt(zoom * 1.2)
          }}
          title="zoom in"
          className="cr-bevel"
          style={{
            background: 'var(--cream-hi)',
            padding: '5px 9px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'var(--ink)',
            opacity: zoom >= Z_MAX - 0.001 ? 0.5 : 1,
          }}
        >
          ＋
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            fitAll()
          }}
          title="fit all tasks into view"
          className="cr-bevel"
          style={{
            background: 'var(--cream-hi)',
            padding: '5px 9px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'var(--ink)',
          }}
        >
          ⤢ FIT
        </button>
      </div>

      {(shiftDown || linkSrc) && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#5C4A1F',
            color: 'var(--cream-hi)',
            padding: '5px 10px',
            border: '2px solid var(--line)',
            boxShadow: '2px 2px 0 var(--line)',
            fontFamily: 'Silkscreen,monospace',
            fontSize: 9,
            letterSpacing: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 20,
          }}
        >
          <span style={{ width: 6, height: 6, background: 'var(--amber)', borderRadius: '50%' }} />
          {linkSrc ? 'DROP ON A TASK TO LINK ›' : 'LINK MODE · DRAG FROM A TASK'}
        </div>
      )}
    </div>
  )
}

interface CrHITLClickbarProps {
  items: HitlItem[]
  onOpen?: (h: HitlItem) => void
  onFocus?: (h: HitlItem) => void
  onBlurItem?: (h: HitlItem) => void
  focusedId?: string | null
  variant?: Variant
}

export function CrHITLClickbar({
  items,
  onOpen,
  onFocus,
  onBlurItem,
  focusedId,
  variant = 'desktop',
}: CrHITLClickbarProps) {
  const isMobile = variant === 'mobile'
  return (
    <div
      className="cr cr-noscrollbar"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        gap: 6,
        padding: isMobile ? 8 : 10,
        background: 'linear-gradient(to top, var(--cream-md) 60%, transparent)',
        borderTop: '2px solid var(--line)',
        overflowX: 'auto',
        alignItems: 'flex-end',
        zIndex: 6,
      }}
    >
      <span
        className="cr-kicker"
        style={{
          fontSize: 8,
          color: 'var(--ink-soft)',
          alignSelf: 'center',
          flexShrink: 0,
          padding: '0 6px 0 2px',
        }}
      >
        HITL · {items.length}
      </span>
      {items.map((h) => {
        const focused = focusedId === h.id
        const tone = {
          bg: h.overdue ? 'var(--rose-soft)' : 'var(--amber-soft)',
          border: h.overdue ? 'var(--rose)' : 'var(--line)',
          ink: h.overdue ? 'var(--rose)' : 'var(--ink)',
          led: h.overdue ? 'red' : 'busy',
          tag: 'BLOCKED · ANSWER',
        }
        return (
          <button
            key={h.id}
            data-hitl-id={h.id}
            onClick={() => onOpen?.(h)}
            onMouseEnter={() => onFocus?.(h)}
            onMouseLeave={() => onBlurItem?.(h)}
            onFocus={() => onFocus?.(h)}
            onBlur={() => onBlurItem?.(h)}
            className="cr-bevel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: tone.bg,
              borderColor: tone.border,
              outline: focused ? '2px solid var(--amber-deep)' : 'none',
              outlineOffset: 2,
              cursor: 'pointer',
              flexShrink: 0,
              minHeight: 36,
              transform: focused ? 'translate(-1px,-1px)' : 'none',
              boxShadow: focused ? `4px 4px 0 ${tone.border}` : undefined,
              transition: 'transform 80ms, box-shadow 80ms',
            }}
          >
            <span className={`cr-led ${tone.led}`} />
            <span
              className="cr-kicker"
              style={{
                fontSize: 7,
                letterSpacing: 0.6,
                padding: '1px 4px',
                border: `1px solid ${tone.border}`,
                color: tone.ink,
                background: 'rgba(255,255,255,0.5)',
              }}
            >
              {tone.tag}
            </span>
            <span
              className="cr-display"
              style={{
                fontSize: 9,
                color: tone.ink,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {h.label}
            </span>
            <span className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
              · {h.from} · {h.pending}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface CrMissionBoardProps {
  variant?: Variant
  tasks: Task[]
  hitl?: HitlItem[]
  onSelectTask?: (t: Task) => void
  onShowFeed?: (t: Task) => void
  onAddDraft?: (point: { x: number; y: number }) => void
  draftId?: string | null
  onLinkTasks?: (srcId: string, tgtId: string) => void
  onOpenHitl?: (h: HitlItem) => void
  formatTick?: number
  bundles: Bundle[]
  activeBundleId: string
  onSelectBundle?: (id: string) => void
  onAddBundle?: () => void
  onCloseBundle?: (id: string) => void
  onRenameBundle?: (id: string, name: string) => void
}

export function CrMissionBoard({
  variant = 'desktop',
  tasks,
  hitl = [],
  onSelectTask,
  onShowFeed,
  onAddDraft,
  draftId,
  onLinkTasks,
  onOpenHitl,
  formatTick,
  bundles,
  activeBundleId,
  onSelectBundle,
  onAddBundle,
  onCloseBundle,
  onRenameBundle,
}: CrMissionBoardProps) {
  const [focusedHitlId, setFocusedHitlId] = useState<string | null>(null)
  const focusedItem = hitl.find((h) => h.id === focusedHitlId) ?? null
  const focusedTaskId = focusedItem ? focusedItem.taskId : null

  return (
    <div
      className="cr"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: 'var(--cream-md)',
        position: 'relative',
      }}
    >
      <CrBundleTabs
        variant={variant}
        bundles={bundles}
        activeId={activeBundleId}
        onSelect={onSelectBundle}
        onAdd={onAddBundle}
        onClose={onCloseBundle}
        onRename={onRenameBundle}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CrTaskCanvas
          tasks={tasks}
          variant={variant}
          onSelect={onSelectTask}
          onShowFeed={onShowFeed}
          onDoubleClickCanvas={onAddDraft}
          draftId={draftId}
          onLinkTasks={onLinkTasks}
          formatTick={formatTick}
          hitlFocusTaskId={focusedTaskId}
        />
        {hitl.length > 0 && (
          <CrHITLClickbar
            items={hitl}
            variant={variant}
            focusedId={focusedHitlId}
            onFocus={(h) => setFocusedHitlId(h.id)}
            onBlurItem={(h) =>
              setFocusedHitlId((id) => (id === h.id ? null : id))
            }
            onOpen={(h) => onOpenHitl?.(h)}
          />
        )}
      </div>
    </div>
  )
}

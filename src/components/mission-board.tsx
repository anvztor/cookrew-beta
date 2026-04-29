import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { CrButton, CrChip, CrLED } from './atoms/atoms'
import { CR_HITL, CR_STATUS, CR_TASKS, type HitlItem, type Task } from '../data/tasks'
import type { Variant } from './party-sidebar'

interface CrBundleTitleProps {
  bundle?: string
  name?: string
  total?: number
  blocked?: number
  working?: number
  done?: number
  variant?: Variant
  onNew?: () => void
}

export function CrBundleTitle({
  bundle = 'BUN_4A2C',
  name = 'Heartbeat reliability sweep',
  total = 11,
  blocked = 1,
  working = 2,
  done = 1,
  variant = 'desktop',
  onNew,
}: CrBundleTitleProps) {
  const isMobile = variant === 'mobile'
  return (
    <div
      className="cr"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: isMobile ? '10px 14px' : '14px 18px',
        borderBottom: '2px solid var(--line)',
        background: 'var(--cream-hi)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="cr-display" style={{ fontSize: isMobile ? 11 : 13 }}>{bundle}</span>
          <CrChip tone="amber" style={{ fontSize: 7 }}>LIVE</CrChip>
        </div>
        <div
          style={{
            fontFamily: 'Inter,sans-serif',
            fontSize: isMobile ? 13 : 15,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
            {total} QUESTS
          </span>
          {done > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <CrLED state="on" />
              <span className="cr-mono" style={{ fontSize: 9 }}>{done}</span>
            </span>
          )}
          {working > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <CrLED state="busy" />
              <span className="cr-mono" style={{ fontSize: 9 }}>{working}</span>
            </span>
          )}
          {blocked > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <CrLED state="red" />
              <span className="cr-mono" style={{ fontSize: 9 }}>{blocked}</span>
            </span>
          )}
        </div>
      </div>
      <CrButton variant="primary" size={isMobile ? 'tiny' : 'sm'} onClick={onNew}>
        ＋ NEW
      </CrButton>
    </div>
  )
}

interface CrTaskLiveCardProps {
  t: Task
  compact?: boolean
  highlight?: boolean
  onClick?: () => void
  style?: CSSProperties
  dragging?: boolean
}

export function CrTaskLiveCard({
  t,
  compact = false,
  highlight = false,
  onClick,
  style,
  dragging,
}: CrTaskLiveCardProps) {
  const st = CR_STATUS[t.blocked ? 'blocked' : t.status]
  return (
    <div
      onClick={onClick}
      className="cr-bevel"
      style={{
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: dragging ? 'grabbing' : onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 5 : 8,
        background: 'var(--cream-hi)',
        width: '100%',
        outline: highlight ? '2px solid var(--amber-deep)' : 'none',
        outlineOffset: 1,
        boxShadow: dragging ? '6px 6px 0 rgba(0,0,0,0.25)' : undefined,
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
              t.status === 'done'
                ? 'on'
                : t.status === 'working'
                  ? 'busy'
                  : t.blocked
                    ? 'red'
                    : 'off'
            }
          />
        </div>
        <CrChip
          style={{
            background: st.bg,
            color: st.ink,
            borderColor: 'var(--line)',
            fontSize: 7,
          }}
        >
          {st.label}
        </CrChip>
      </div>
      <div
        style={{
          fontFamily: 'Inter,sans-serif',
          fontSize: compact ? 13 : 14,
          fontWeight: 600,
          color: 'var(--ink)',
          lineHeight: 1.3,
        }}
      >
        {t.title}
      </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CrChip tone="slate" style={{ fontSize: 7 }}>{t.assignee}</CrChip>
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
        </div>
        {(t.adds > 0 || t.dels > 0) && (
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
  tasks?: Task[]
  variant?: Variant
  onSelect?: (t: Task) => void
}

interface CardPos {
  x: number
  y: number
}

export function CrTaskCanvas({
  tasks = CR_TASKS,
  variant = 'desktop',
  onSelect,
}: CrTaskCanvasProps) {
  const initialPos: Record<string, CardPos> = Object.fromEntries(
    tasks.map((t) => [t.id, { x: t.x, y: t.y }]),
  )
  const [pos, setPos] = useState<Record<string, CardPos>>(initialPos)
  const [pan, setPan] = useState<CardPos>({ x: 0, y: 0 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const vpRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    id: string
    x: number
    y: number
    ox: number
    oy: number
  } | null>(null)
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const isMobile = variant === 'mobile'
  const CARD_W = isMobile ? 180 : 220
  const CARD_H = isMobile ? 120 : 132

  const onVPDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-task-card]')) return
    if (e.button !== 0 && e.button !== 1) return
    e.preventDefault()
    panRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    vpRef.current?.setPointerCapture(e.pointerId)
  }
  const onVPMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return
    setPan({
      x: panRef.current.px + (e.clientX - panRef.current.x),
      y: panRef.current.py + (e.clientY - panRef.current.y),
    })
  }
  const onVPUp = () => {
    panRef.current = null
  }

  const onCardDown = (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const cardPos = pos[id]
    if (!cardPos) return
    dragRef.current = { id, x: e.clientX, y: e.clientY, ox: cardPos.x, oy: cardPos.y }
    setDraggingId(id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onCardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const d = dragRef.current
    setPos((p) => ({
      ...p,
      [d.id]: { x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) },
    }))
  }
  const onCardUp = () => {
    dragRef.current = null
    setDraggingId(null)
  }

  const xs = Object.values(pos).map((p) => p.x)
  const ys = Object.values(pos).map((p) => p.y)
  const W = Math.max(...xs) + CARD_W + 200
  const H = Math.max(...ys) + CARD_H + 200

  return (
    <div
      ref={vpRef}
      className="cr"
      onPointerDown={onVPDown}
      onPointerMove={onVPMove}
      onPointerUp={onVPUp}
      onPointerCancel={onVPUp}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--cream-md)',
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)',
        backgroundSize: '12px 12px',
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
        }}
      >
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {tasks.flatMap((t) =>
            (t.deps || []).map((dep) => {
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
              return (
                <g key={t.id + dep}>
                  <path
                    d={`M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}`}
                    stroke={stroke}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 3"
                    opacity="0.55"
                  />
                  <circle cx={ax} cy={ay} r="3" fill={stroke} />
                  <circle cx={bx} cy={by} r="3" fill={stroke} />
                </g>
              )
            }),
          )}
        </svg>
        {tasks.map((t) => {
          const p = pos[t.id]
          if (!p) return null
          return (
            <div
              key={t.id}
              data-task-card
              onPointerDown={(e) => onCardDown(t.id, e)}
              onPointerMove={onCardMove}
              onPointerUp={onCardUp}
              onPointerCancel={onCardUp}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: CARD_W,
                zIndex: draggingId === t.id ? 10 : 1,
                touchAction: 'none',
              }}
            >
              <CrTaskLiveCard
                t={t}
                compact={isMobile}
                dragging={draggingId === t.id}
                onClick={() => onSelect?.(t)}
              />
            </div>
          )
        })}
      </div>
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
        drag bg to pan · drag cards to rearrange
      </div>
    </div>
  )
}

interface CrHITLClickbarProps {
  items?: HitlItem[]
  onRestore?: (h: HitlItem) => void
  variant?: Variant
}

export function CrHITLClickbar({
  items = CR_HITL,
  onRestore,
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
        HITL
      </span>
      {items.map((h) => (
        <button
          key={h.id}
          onClick={() => onRestore?.(h)}
          className="cr-bevel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: h.overdue ? 'var(--rose-soft)' : 'var(--amber-soft)',
            borderColor: h.overdue ? 'var(--rose)' : 'var(--line)',
            cursor: 'pointer',
            flexShrink: 0,
            minHeight: 36,
          }}
        >
          <span className={`cr-led ${h.overdue ? 'red' : 'busy'}`} />
          <span
            className="cr-display"
            style={{ fontSize: 9, color: h.overdue ? 'var(--rose)' : 'var(--ink)' }}
          >
            {h.task}
          </span>
          <span className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
            · {h.from} · {h.pending}
          </span>
        </button>
      ))}
    </div>
  )
}

interface CrMissionBoardProps {
  variant?: Variant
  tasks?: Task[]
  hitl?: HitlItem[]
  onNewQuest?: () => void
  onSelectTask?: (t: Task | HitlItem) => void
}

export function CrMissionBoard({
  variant = 'desktop',
  tasks = CR_TASKS,
  hitl = CR_HITL,
  onNewQuest,
  onSelectTask,
}: CrMissionBoardProps) {
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
      <CrBundleTitle
        variant={variant}
        onNew={onNewQuest}
        total={tasks.length}
        done={tasks.filter((t) => t.status === 'done').length}
        working={tasks.filter((t) => t.status === 'working' && !t.blocked).length}
        blocked={tasks.filter((t) => t.blocked).length}
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
        <CrTaskCanvas tasks={tasks} variant={variant} onSelect={onSelectTask} />
        {hitl && hitl.length > 0 && (
          <CrHITLClickbar items={hitl} variant={variant} onRestore={onSelectTask} />
        )}
      </div>
    </div>
  )
}

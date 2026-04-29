import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Variant } from './party-sidebar'

export interface ModeDef {
  v: string
  l: string
  bg: string
  fg: string
  tip: string
}

export const CR_MODES: ModeDef[] = [
  { v: 'orch',   l: 'ORCH',   bg: 'var(--amber)',    fg: '#1A1408',   tip: 'compose a bundle of tasks for agents' },
  { v: 'assign', l: 'ASSIGN', bg: '#A9E4C2',         fg: '#0B4F2E',   tip: 'send one task to one agent' },
  { v: 'ask',    l: 'ASK',    bg: 'var(--cream-md)', fg: 'var(--ink)', tip: 'clarify before agents act' },
]

interface CrModeDialProps {
  value?: string
  onChange?: (v: string) => void
  variant?: Variant
}

export function CrModeDial({ value = 'orch', onChange, variant = 'desktop' }: CrModeDialProps) {
  const N = CR_MODES.length
  const idx = Math.max(0, CR_MODES.findIndex((m) => m.v === value))
  const m = CR_MODES[idx] || CR_MODES[0]
  const isMobile = variant === 'mobile'

  const FACES = Math.max(N, 8)
  const FACE_H = isMobile ? 22 : 26
  const FACE_ANGLE = 360 / FACES
  const RADIUS = FACE_H / 2 / Math.tan(Math.PI / FACES)
  const VIEWPORT_H = Math.round(RADIUS * 2 + 4)
  const ROLLER_W = isMobile ? 116 : 144

  const [animating, setAnimating] = useState(false)
  const [drag, setDrag] = useState<{ startY: number; dy: number; moved: boolean } | null>(null)
  const wheelLock = useRef(0)

  const wrap = (i: number) => ((i % N) + N) % N
  const setIdx = (next: number) => {
    const v = CR_MODES[wrap(next)].v
    if (v !== value) onChange?.(v)
  }
  const step = (dir: number) => {
    setAnimating(true)
    setIdx(idx + dir)
    window.setTimeout(() => setAnimating(false), 240)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ startY: e.clientY, dy: 0, moved: false })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const dy = e.clientY - drag.startY
    setDrag((d) => (d ? { ...d, dy, moved: d.moved || Math.abs(dy) > 3 } : d))
  }
  const onPointerUp = () => {
    if (!drag) return
    const { dy, moved } = drag
    setDrag(null)
    if (!moved) {
      step(1)
      return
    }
    const steps = Math.round(-dy / FACE_H)
    if (steps !== 0) {
      setAnimating(true)
      setIdx(idx + steps)
      window.setTimeout(() => setAnimating(false), 240)
    }
  }
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - wheelLock.current < 180) return
    if (Math.abs(e.deltaY) < 4) return
    wheelLock.current = now
    step(e.deltaY > 0 ? 1 : -1)
  }

  const dragSteps = drag ? Math.max(-1.6, Math.min(1.6, -drag.dy / FACE_H)) : 0
  const drumAngle = -dragSteps * FACE_ANGLE
  const drumTransition = drag
    ? 'none'
    : animating
      ? 'transform 240ms cubic-bezier(.2,.85,.3,1)'
      : 'transform 0ms'

  const Face = ({
    face,
    slot,
    isCenter,
  }: {
    face: ModeDef
    slot: number
    isCenter: boolean
  }) => {
    const angle = slot * FACE_ANGLE
    const style: CSSProperties = {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: FACE_H,
      marginTop: -FACE_H / 2,
      transform: `rotateX(${angle}deg) translateZ(${RADIUS}px)`,
      backfaceVisibility: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      background: isCenter ? 'var(--amber-soft)' : 'var(--cream-hi)',
      borderTop: '1px dashed rgba(45,42,32,0.18)',
      borderBottom: '1px dashed rgba(45,42,32,0.18)',
    }
    return (
      <div style={style}>
        <span
          style={{
            width: 8,
            height: 8,
            background: face.bg,
            boxShadow:
              'inset -1px -1px 0 rgba(0,0,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.6)',
          }}
        />
        <span
          style={{
            fontFamily: "'Silkscreen',monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: 'var(--ink)',
          }}
        >
          {face.l}
        </span>
      </div>
    )
  }

  return (
    <div
      title={`${m.tip} · drag, click, or scroll`}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        step(-1)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        position: 'relative',
        width: ROLLER_W,
        height: VIEWPORT_H,
        flexShrink: 0,
        background: 'var(--cream-md)',
        boxShadow:
          'inset 2px 2px 0 rgba(0,0,0,0.18), inset -2px -2px 0 var(--cream-hi)',
        userSelect: 'none',
        cursor: drag ? 'grabbing' : 'grab',
        touchAction: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, perspective: 600, perspectiveOrigin: '50% 50%' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `translateZ(${-RADIUS}px) rotateX(${drumAngle}deg)`,
            transition: drumTransition,
            willChange: 'transform',
          }}
        >
          {CR_MODES.map((face, i) => {
            let slot = i - idx
            if (slot > N / 2) slot -= N
            if (slot < -N / 2) slot += N
            return <Face key={face.v} face={face} slot={slot} isCenter={slot === 0} />
          })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '40%',
          background:
            'linear-gradient(to bottom, rgba(45,42,32,0.22), rgba(45,42,32,0))',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '40%',
          background: 'linear-gradient(to top, rgba(45,42,32,0.22), rgba(45,42,32,0))',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: FACE_H,
          marginTop: -FACE_H / 2,
          borderTop: '1.5px solid var(--amber-deep)',
          borderBottom: '1.5px solid var(--amber-deep)',
          boxShadow: 'inset 0 0 0 1px rgba(217,119,6,0.18)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 4,
          top: 2,
          fontFamily: "'Silkscreen',monospace",
          fontSize: 6,
          color: 'var(--muted)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        ▲
      </div>
      <div
        style={{
          position: 'absolute',
          right: 4,
          bottom: 2,
          fontFamily: "'Silkscreen',monospace",
          fontSize: 6,
          color: 'var(--muted)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        ▼
      </div>
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: '50%',
          marginTop: -FACE_H / 2 - 9,
          fontFamily: "'Silkscreen',monospace",
          fontSize: 7,
          color: 'var(--amber-deep)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        {idx + 1}/{N}
      </div>
    </div>
  )
}

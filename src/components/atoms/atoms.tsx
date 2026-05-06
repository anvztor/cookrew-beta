import type { CSSProperties, ReactNode } from 'react'

type ChipTone = '' | 'amber' | 'violet' | 'emerald' | 'rose' | 'blue' | 'slate' | 'phos'
type ButtonVariant = '' | 'primary' | 'danger' | 'ghost'
type ButtonSize = '' | 'sm' | 'tiny'

interface CrButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  touch?: boolean
  children: ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  style?: CSSProperties
  title?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export function CrButton({
  variant = '',
  size = '',
  block,
  touch,
  children,
  onClick,
  style,
  title,
  type = 'button',
  disabled,
}: CrButtonProps) {
  const cls = ['cr-btn', variant, size, block && 'block', touch && 'touch'].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      style={style}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

interface CrChipProps {
  tone?: ChipTone
  children: ReactNode
  style?: CSSProperties
}

export function CrChip({ tone = '', children, style }: CrChipProps) {
  return (
    <span className={['cr-chip', tone].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  )
}

type LedState = 'on' | 'off' | 'busy' | 'red' | 'blue'

export function CrLED({ state = 'on', style }: { state?: LedState; style?: CSSProperties }) {
  return <span className={`cr-led ${state}`} style={style} />
}

type BarKind = 'hp' | 'mp' | 'xp'

interface CrBarProps {
  label: string
  value: number
  max?: number
  kind?: BarKind
}

export function CrBar({ label, value, max = 100, kind = 'hp' }: CrBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const low = kind === 'hp' && pct < 25
  return (
    <div className={`cr-bar ${kind}${low ? ' low' : ''}`}>
      <div>{label}</div>
      <div className="cr-bar-track">
        <div className="cr-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="cr-bar-val">
        {value}/{max}
      </div>
    </div>
  )
}

export function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.0', '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace('.0', '')}k`
  return String(n)
}

interface CrTokBarProps {
  label?: string
  used?: number
  max?: number
  kind?: 'hp' | 'mp' | 'amber'
  segments?: number
}

export function CrTokBar({
  label = '5h',
  used = 0,
  max = 1,
  kind = 'mp',
  segments = 12,
}: CrTokBarProps) {
  const remaining = Math.max(0, max - used)
  const remPct = remaining / Math.max(1, max)
  const filled = Math.round(remPct * segments)
  const critical = remPct <= 0.1
  const tone = critical ? 'rose' : kind
  return (
    <div className={`cr-tok ${tone}`}>
      <div style={{ fontSize: 8, color: 'var(--ink)' }}>{label}</div>
      <div className="cr-tok-track">
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className={`cr-tok-seg${i < filled ? ' on' : ''}`} />
        ))}
      </div>
      <div className="cr-tok-val">
        {fmtTok(remaining)}/{fmtTok(max)}
      </div>
    </div>
  )
}

type CrInputProps = React.InputHTMLAttributes<HTMLInputElement>

export function CrInput(props: CrInputProps) {
  const { className, ...rest } = props
  return <input {...rest} className={['cr-input', className].filter(Boolean).join(' ')} />
}

import type { CSSProperties } from 'react'
import { CrButton, CrChip, CrLED } from './atoms/atoms'
import { CR_PORTRAITS, CrSprite, type PortraitId } from './atoms/sprite'
import { detectDeviceInsets } from '../lib/insets'
import type { Variant } from './party-sidebar'
import type { RosterStatus } from '../data/roster'

interface CrLogoProps {
  size?: 'sm' | 'md' | 'lg'
  tag?: string | null
  tagTone?: 'phos' | 'amber' | 'slate'
}

export function CrLogo({ size = 'md', tag = 'BETA', tagTone = 'phos' }: CrLogoProps) {
  const sz = size === 'lg' ? 22 : size === 'sm' ? 11 : 14
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gridTemplateRows: 'repeat(3,1fr)',
          width: sz + 8,
          height: sz + 8,
          gap: 1,
          padding: 1,
          background: 'var(--ink)',
          boxShadow: '2px 2px 0 var(--line)',
        }}
      >
        {[1, 1, 1, 1, 0, 1, 1, 1, 0].map((on, i) => (
          <span key={i} style={{ background: on ? 'var(--amber)' : 'transparent' }} />
        ))}
      </span>
      <span className="cr-display" style={{ fontSize: sz, color: 'var(--ink)' }}>
        COOKREW
      </span>
      {tag && (
        <CrChip tone={tagTone} style={{ fontSize: 7 }}>
          {tag}
        </CrChip>
      )}
    </div>
  )
}

interface CrProfileAvatarProps {
  name?: string
  sub?: string
  portrait?: PortraitId
  hp?: number
  max?: number
  status?: RosterStatus
  size?: number
  showMeta?: boolean
  onClick?: () => void
}

export function CrProfileAvatar({
  name = 'ALEX',
  sub = 'OPERATOR',
  portrait = 'human',
  hp = 92,
  max = 100,
  status = 'on',
  size = 40,
  showMeta = false,
  onClick,
}: CrProfileAvatarProps) {
  return (
    <button
      onClick={onClick}
      title={name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: showMeta ? 10 : 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <CrSprite
          art={CR_PORTRAITS[portrait] || CR_PORTRAITS.human}
          size={size}
          bg="var(--cream-hi)"
        />
        <span style={{ position: 'absolute', bottom: -2, right: -2 }}>
          <CrLED state={status} />
        </span>
      </span>
      {showMeta && (
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
          <span className="cr-display" style={{ fontSize: 11 }}>
            {name}
          </span>
          <span
            className="cr-mono"
            style={{
              fontSize: 9,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sub} · HP {hp}/{max}
          </span>
        </span>
      )}
    </button>
  )
}

interface CrHeaderProps {
  variant?: Variant
  bundle?: string
  online?: number
  total?: number
  onMenu?: () => void
  onAvatar?: () => void
  onParty?: () => void
  onFeed?: () => void
  partyOpen?: boolean
  feedOpen?: boolean
}

export function CrHeader({
  variant = 'desktop',
  bundle = '',
  online = 0,
  total = 0,
  onMenu,
  onAvatar,
  onParty,
  onFeed,
  partyOpen = false,
  feedOpen = false,
}: CrHeaderProps) {
  const isMobile = variant === 'mobile'
  const devIns = detectDeviceInsets()

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: isMobile ? '10px 12px' : '12px 18px',
    paddingTop: isMobile
      ? `calc(10px + ${devIns.top}px + env(safe-area-inset-top, 0px))`
      : 12,
    paddingLeft: isMobile
      ? `calc(12px + ${devIns.left}px + env(safe-area-inset-left, 0px))`
      : 18,
    paddingRight: isMobile
      ? `calc(12px + ${devIns.right}px + env(safe-area-inset-right, 0px))`
      : 18,
    background: 'var(--cream-hi)',
    borderBottom: '2px solid var(--line)',
    position: 'relative',
    zIndex: 50,
  }

  const iconButtonStyle = (open: boolean): CSSProperties => ({
    border: '2px solid var(--line)',
    background: open ? 'var(--amber)' : 'var(--cream-hi)',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '2px 2px 0 var(--line)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  })

  return (
    <header className="cr" style={headerStyle}>
      <CrLogo size={isMobile ? 'sm' : 'md'} tag={isMobile ? null : 'BETA'} tagTone="phos" />

      {!isMobile && bundle && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            gap: 2,
            marginLeft: 4,
          }}
        >
          <span
            className="cr-mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bundle}
          </span>
        </div>
      )}

      <span style={{ flex: 1 }} />

      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CrChip tone="slate" style={{ fontSize: 8 }}>⌘K SEARCH</CrChip>
          <CrButton size="sm" onClick={onParty}>
            PARTY {partyOpen ? '▾' : '▸'}
          </CrButton>
          <CrButton size="sm" onClick={onFeed}>
            FEED {feedOpen ? '▾' : '▸'}
          </CrButton>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
        <CrLED state="on" />
        <span className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
          {online}/{total}
        </span>
      </div>

      {isMobile && onMenu && (
        <button onClick={onMenu} title="party" aria-label="party" style={iconButtonStyle(partyOpen)}>
          <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
            <g fill="var(--line)">
              <circle cx="3.5" cy="4" r="2" />
              <path d="M0 13 v-2 a3.5 3.5 0 0 1 7 0 v2 z" />
              <circle cx="10" cy="3.5" r="2.4" />
              <path d="M6 13 v-2.4 a4 4 0 0 1 8 0 v2.4 z" />
              <circle cx="16.5" cy="4" r="2" />
              <path d="M13 13 v-2 a3.5 3.5 0 0 1 7 0 v2 z" />
            </g>
          </svg>
        </button>
      )}

      {isMobile && onFeed && (
        <button onClick={onFeed} title="feed" aria-label="feed" style={iconButtonStyle(feedOpen)}>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <g fill="var(--line)">
              <rect x="0" y="1" width="3" height="3" />
              <rect x="5" y="1.5" width="13" height="2" />
              <rect x="0" y="6" width="3" height="3" />
              <rect x="5" y="6.5" width="13" height="2" />
              <rect x="0" y="11" width="3" height="3" />
              <rect x="5" y="11.5" width="13" height="2" />
            </g>
          </svg>
        </button>
      )}

      <CrProfileAvatar
        name="ALEX"
        sub="OPERATOR"
        portrait="human"
        hp={92}
        max={100}
        status="on"
        size={isMobile ? 32 : 40}
        showMeta={!isMobile}
        onClick={onAvatar}
      />
    </header>
  )
}

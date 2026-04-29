import { CrBar, CrButton, CrChip, CrLED, CrTokBar } from './atoms/atoms'
import { CR_PORTRAITS, CrSprite } from './atoms/sprite'
import { CR_ROSTER } from '../data/roster'

export type Variant = 'desktop' | 'mobile'

interface CrPartySidebarProps {
  collapsed?: boolean
  active?: string
  onSelect?: (id: string) => void
  variant?: Variant
}

export function CrPartySidebar({
  collapsed = false,
  active = 'scout',
  onSelect,
}: CrPartySidebarProps) {
  const online = CR_ROSTER.filter((r) => r.status !== 'off').length
  const w = collapsed ? 64 : 240
  return (
    <aside
      className="cr"
      style={{
        width: w,
        height: '100%',
        flexShrink: 0,
        background: 'var(--cream-md)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 180ms ease',
      }}
    >
      <div
        style={{
          padding: collapsed ? '12px 8px' : '14px 14px',
          borderBottom: '2px solid var(--line)',
          background: 'var(--cream-hi)',
        }}
      >
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div className="cr-display" style={{ fontSize: 10 }}>CR</div>
            <CrLED state="on" />
          </div>
        ) : (
          <div className="cr-kicker" style={{ fontSize: 8 }}>
            PARTY · {online}/{CR_ROSTER.length} ONLINE
          </div>
        )}
      </div>
      <div
        className="cr-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 6px' : '10px 10px' }}
      >
        {CR_ROSTER.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect?.(m.id)}
            style={{
              width: '100%',
              padding: collapsed ? '6px 4px' : '8px',
              border: 'none',
              cursor: 'pointer',
              background: active === m.id ? 'var(--amber-soft)' : 'transparent',
              display: 'flex',
              alignItems: collapsed ? 'center' : 'flex-start',
              justifyContent: collapsed ? 'center' : 'flex-start',
              flexDirection: collapsed ? 'column' : 'row',
              gap: collapsed ? 4 : 10,
              marginBottom: 2,
              borderLeft: collapsed
                ? 'none'
                : `3px solid ${active === m.id ? 'var(--ink)' : 'transparent'}`,
              textAlign: 'left',
              opacity: m.status === 'off' ? 0.55 : 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              <CrSprite art={CR_PORTRAITS[m.portrait]} size={collapsed ? 36 : 40} bg="var(--cream-hi)" />
              <div style={{ position: 'absolute', bottom: -2, right: -2 }}>
                <CrLED state={m.status} />
              </div>
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 4,
                  }}
                >
                  <div className="cr-display" style={{ fontSize: 10 }}>{m.name}</div>
                  <CrChip
                    tone={m.kind === 'human' ? 'amber' : 'slate'}
                    style={{ fontSize: 7, padding: '1px 4px' }}
                  >
                    {m.kind === 'human' ? 'P1' : 'NPC'}
                  </CrChip>
                </div>
                <div
                  className="cr-mono"
                  style={{
                    fontSize: 9,
                    color: 'var(--muted)',
                    marginTop: 2,
                    marginBottom: 6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.sub}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <CrBar label="HP" value={m.hp} max={m.max} kind="hp" />
                  {m.kind === 'agent' && (
                    <CrTokBar label="CTX" used={m.used} max={m.ctxMax} kind="mp" segments={10} />
                  )}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      {!collapsed && (
        <div
          style={{
            borderTop: '2px solid var(--line)',
            padding: 10,
            background: 'var(--cream-hi)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <CrButton variant="primary" size="sm" block>＋ HIRE AGENT</CrButton>
          <CrButton variant="ghost" size="sm" block>⚙ CONFIG</CrButton>
        </div>
      )}
    </aside>
  )
}

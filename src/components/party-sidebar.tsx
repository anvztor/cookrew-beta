import { CrBar, CrButton, CrChip, CrLED, CrTokBar } from './atoms/atoms'
import { CR_PORTRAITS, CrSprite } from './atoms/sprite'
import type { RosterMember } from '../data/roster'
import type { Task } from '../data/tasks'

export type Variant = 'desktop' | 'mobile'

interface CrPartySidebarProps {
  collapsed?: boolean
  active?: string
  onSelect?: (id: string) => void
  variant?: Variant
  roster: RosterMember[]
  onHire?: () => void
  tasks?: Task[]
}

export function CrPartySidebar({
  collapsed = false,
  active = 'scout',
  onSelect,
  roster,
  onHire,
  tasks = [],
}: CrPartySidebarProps) {
  // Build a map: agent name → active task title (working only).
  const taskByAgent: Record<string, Task> = {}
  tasks.forEach((t) => {
    if (t.status === 'working' && t.assignee && t.assignee !== '—') {
      taskByAgent[t.assignee] = t
    }
  })

  const online = roster.filter((r) => r.status !== 'off').length
  const w = collapsed ? 64 : 240

  const hasAgents = roster.some((r) => r.kind === 'agent')

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
            PARTY · {online}/{roster.length} ONLINE
          </div>
        )}
      </div>

      <div
        className="cr-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 6px' : '10px 10px' }}
      >
        {!hasAgents && !collapsed && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                border: '2px dashed var(--line-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Silkscreen,monospace',
                fontSize: 22,
                color: 'var(--muted)',
              }}
            >
              ?
            </div>
            <div className="cr-display" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
              NO AGENTS
            </div>
            <div
              className="cr-mono"
              style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}
            >
              Hire one to start delegating quests.
            </div>
          </div>
        )}

        {roster.map((m) => (
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

                {m.status === 'busy' && taskByAgent[m.name] && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginBottom: 6,
                      fontSize: 9,
                      lineHeight: 1.3,
                    }}
                  >
                    <span className="cr-led busy" style={{ flexShrink: 0 }} />
                    <span
                      className="cr-mono"
                      style={{ color: 'var(--amber-deep)', fontWeight: 700, flexShrink: 0 }}
                    >
                      #{taskByAgent[m.name].no}
                    </span>
                    <span
                      className="cr-mono"
                      style={{
                        color: 'var(--muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {taskByAgent[m.name].title || '(untitled)'}
                    </span>
                  </div>
                )}

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
          <CrButton variant="primary" size="sm" block onClick={onHire}>
            ＋ HIRE AGENT
          </CrButton>
          <CrButton variant="ghost" size="sm" block>
            ⚙ CONFIG
          </CrButton>
        </div>
      )}
    </aside>
  )
}

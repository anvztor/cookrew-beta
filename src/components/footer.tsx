import { useRef, useState, type CSSProperties } from 'react'
import { CrChip, CrLED } from './atoms/atoms'
import { CrModeDial } from './mode-dial'
import { CR_ROSTER } from '../data/roster'
import { detectDeviceInsets } from '../lib/insets'
import type { Variant } from './party-sidebar'

interface SlashCmd {
  cmd: string
  desc: string
  icon: string
}

const CR_SLASH: SlashCmd[] = [
  { cmd: '/bundle', desc: 'Start a new bundle from a prompt', icon: '◆' },
  { cmd: '/claim',  desc: 'Force-claim an open quest',        icon: '♦' },
  { cmd: '/digest', desc: 'Summarize a session',              icon: '▤' },
  { cmd: '/replay', desc: 'Replay a digest as new bundle',    icon: '▷' },
  { cmd: '/spawn',  desc: 'Spawn an agent on a quest',        icon: '✦' },
]

interface CrPromptShipBoxProps {
  mode?: string
  variant?: Variant
  onSend?: (payload: { mode: string; text: string }) => void
}

type MenuKind = 'slash' | 'mention' | null

function lastToken(v: string) {
  return v.split(/\s/).pop() || ''
}

export function CrPromptShipBox({
  mode = 'orch',
  variant = 'desktop',
  onSend,
}: CrPromptShipBoxProps) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState<MenuKind>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const isMobile = variant === 'mobile'

  const placeholder =
    mode === 'ask'
      ? 'clarify before agents act · ⏎ to ask'
      : mode === 'assign'
        ? 'send one task to one agent · "@" · ⏎ to ship'
        : 'compose a bundle of tasks · "/" · "@" · ⏎ to ship'

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)
    const last = lastToken(v)
    if (last.startsWith('/')) setMenu('slash')
    else if (last.startsWith('@')) setMenu('mention')
    else setMenu(null)
  }

  const insertToken = (tok: string) => {
    const parts = text.split(/\s/)
    parts[parts.length - 1] = tok + ' '
    setText(parts.join(' '))
    setMenu(null)
    taRef.current?.focus()
  }

  const send = () => {
    if (!text.trim()) return
    onSend?.({ mode, text })
    setText('')
    setMenu(null)
  }

  const mentionFilter = lastToken(text).slice(1).toLowerCase()
  const mentions = CR_ROSTER.filter((r) => r.status !== 'off').filter(
    (r) =>
      !mentionFilter ||
      r.name.toLowerCase().startsWith(mentionFilter) ||
      r.id.toLowerCase().startsWith(mentionFilter),
  )
  const slashFilter = lastToken(text)
  const slashes = CR_SLASH.filter((c) => c.cmd.startsWith(slashFilter || '/'))

  const menuStyle: CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 6,
    overflowY: 'auto',
    zIndex: 10,
    padding: 4,
    background: 'var(--cream-hi)',
  }

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {menu === 'slash' && slashes.length > 0 && (
        <div className="cr-bevel" style={{ ...menuStyle, maxHeight: 220 }}>
          <div
            className="cr-kicker"
            style={{ fontSize: 8, padding: '6px 10px', borderBottom: '1.5px solid var(--line-soft)' }}
          >
            SLASH COMMANDS
          </div>
          {slashes.map((s) => (
            <button
              key={s.cmd}
              onClick={() => insertToken(s.cmd)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <span className="cr-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                {s.cmd}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.desc}
              </span>
            </button>
          ))}
        </div>
      )}
      {menu === 'mention' && mentions.length > 0 && (
        <div className="cr-bevel" style={{ ...menuStyle, maxHeight: 240 }}>
          <div
            className="cr-kicker"
            style={{ fontSize: 8, padding: '6px 10px', borderBottom: '1.5px solid var(--line-soft)' }}
          >
            PARTY · MENTION
          </div>
          {mentions.map((r) => {
            const dot =
              r.status === 'busy'
                ? 'var(--amber)'
                : r.status === 'on'
                  ? 'var(--hp)'
                  : 'var(--muted)'
            return (
              <button
                key={r.id}
                onClick={() => insertToken('@' + r.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    border: '1.5px solid var(--line)',
                    background: 'var(--cream)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'Silkscreen, monospace',
                    imageRendering: 'pixelated',
                  }}
                >
                  {r.name.slice(0, 1)}
                </span>
                <span
                  className="cr-mono"
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}
                >
                  @{r.id}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.sub}
                </span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: dot,
                    flexShrink: 0,
                  }}
                />
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
        <button
          onClick={() => setMenu(menu === 'slash' ? null : 'slash')}
          title="slash commands"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '0 10px',
            fontFamily: "'Silkscreen',monospace",
            fontSize: 14,
            fontWeight: 700,
            color: menu === 'slash' ? 'var(--amber-deep)' : 'var(--muted)',
            flexShrink: 0,
            alignSelf: 'stretch',
          }}
        >
          /
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={onChange}
          placeholder={placeholder}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            border: 'none',
            background: 'transparent',
            padding: isMobile ? '12px 10px 12px 0' : '14px 12px 14px 0',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            color: 'var(--ink)',
            resize: 'none',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          title="ship ⏎"
          style={{
            width: isMobile ? 56 : 92,
            flexShrink: 0,
            border: 'none',
            borderLeft: '1.5px solid var(--line)',
            background: text.trim() ? 'var(--amber)' : 'var(--cream-md)',
            color: text.trim() ? '#1A1408' : 'var(--muted)',
            fontFamily: "'Silkscreen',monospace",
            fontSize: isMobile ? 14 : 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: text.trim() ? 'pointer' : 'default',
            transition: 'background 120ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {isMobile ? (
            '▶'
          ) : (
            <>
              <span>SHIP</span>
              <span>▶</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

interface CrFooterProps {
  variant?: Variant
  onSend?: (payload: { mode: string; text: string }) => void
}

export function CrFooter({ variant = 'desktop', onSend }: CrFooterProps) {
  const [mode, setMode] = useState('orch')
  const isMobile = variant === 'mobile'
  const devIns = detectDeviceInsets()

  return (
    <footer
      className="cr"
      style={{
        borderTop: '2px solid var(--line)',
        background: 'var(--cream-hi)',
        padding: isMobile ? '10px 12px 0' : '12px 18px',
        paddingLeft: isMobile
          ? `calc(12px + ${devIns.left}px + env(safe-area-inset-left, 0px))`
          : 18,
        paddingRight: isMobile
          ? `calc(12px + ${devIns.right}px + env(safe-area-inset-right, 0px))`
          : 18,
        paddingBottom: isMobile
          ? `calc(${devIns.bottom}px + env(safe-area-inset-bottom, 0px))`
          : 14,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          border: '2px solid var(--line)',
          background: 'var(--cream-hi)',
          boxShadow: '2px 2px 0 var(--line)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRight: '1.5px solid var(--line)',
            background: 'var(--cream-md)',
            flexShrink: 0,
          }}
        >
          <CrModeDial value={mode} onChange={setMode} variant={variant} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <CrPromptShipBox mode={mode} variant={variant} onSend={onSend} />
        </div>
      </div>
      {!isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1.5px dashed var(--line-soft)',
          }}
        >
          <CrLED state="on" />
          <span className="cr-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            3 AGENTS READY
          </span>
          <span style={{ flex: 1 }} />
          <CrChip tone="slate">⌘K SLASH</CrChip>
          <CrChip tone="slate">@ MENTION</CrChip>
          <CrChip tone="slate">↵ SHIP</CrChip>
        </div>
      )}
    </footer>
  )
}

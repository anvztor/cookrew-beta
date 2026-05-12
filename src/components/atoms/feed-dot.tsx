// FeedDot — tiny `>_` button placed at the top-right of every task
// tile and popout header. Tapping it opens the live event feed
// focused on the associated task without invoking the host card's
// normal onClick dispatch (which would route to HITL / Review / etc).

import type { MouseEvent as ReactMouseEvent } from 'react'

type Tone = 'ink' | 'phos' | 'amber' | 'rose'

interface FeedDotProps {
  tone?: Tone
  onClick: (e: ReactMouseEvent) => void
  title?: string
}

export function FeedDot({
  tone = 'ink',
  onClick,
  title = 'Open event feed for this task',
}: FeedDotProps) {
  const color =
    tone === 'phos'
      ? 'var(--phos-hi)'
      : tone === 'amber'
        ? '#5C4A1F'
        : tone === 'rose'
          ? '#DC2626'
          : 'var(--ink)'
  const border =
    tone === 'phos'
      ? 'var(--phos-dim)'
      : tone === 'amber'
        ? '#5C4A1F'
        : tone === 'rose'
          ? '#DC2626'
          : 'var(--line, #1a1a1a)'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="cr-mono"
      style={{
        background: 'transparent',
        border: `1.5px solid ${border}`,
        color,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1,
        padding: '2px 5px',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      &gt;_
    </button>
  )
}

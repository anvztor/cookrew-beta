// CrBundleTabs — strip of bundle tabs above the mission board.
// Click switches; double-click renames; × closes; "+ NEW" adds.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Variant } from './party-sidebar'
import type { Task } from '../data/tasks'

export interface Bundle {
  id: string
  name: string
  tasks: Task[]
}

interface CrBundleTabsProps {
  bundles: Bundle[]
  activeId: string
  onSelect?: (id: string) => void
  onAdd?: () => void
  onClose?: (id: string) => void
  onRename?: (id: string, name: string) => void
  variant?: Variant
}

export function CrBundleTabs({
  bundles,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onRename,
  variant = 'desktop',
}: CrBundleTabsProps) {
  const isMobile = variant === 'mobile'
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startEdit = (b: Bundle) => {
    setEditingId(b.id)
    setEditValue(b.name)
  }
  const commitEdit = () => {
    if (editingId) onRename?.(editingId, editValue.trim() || 'Untitled')
    setEditingId(null)
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--cream-hi)',
    borderBottom: '2px solid var(--line)',
  }

  return (
    <div className="cr" style={containerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
          padding: isMobile ? '6px 6px 0 8px' : '8px 8px 0 12px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'thin',
        }}
      >
        {bundles.map((b) => {
          const isActive = b.id === activeId
          const taskCount = b.tasks?.length ?? 0
          return (
            <div
              key={b.id}
              onClick={() => !isActive && onSelect?.(b.id)}
              onDoubleClick={() => startEdit(b)}
              title={isActive ? 'Double-click to rename' : 'Switch to this bundle'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: isMobile ? '5px 9px 6px' : '6px 12px 7px',
                marginRight: 2,
                background: isActive ? 'var(--cream-md)' : 'transparent',
                border: isActive ? '2px solid var(--line)' : '2px solid transparent',
                borderBottom: isActive ? '2px solid var(--cream-md)' : '2px solid transparent',
                marginBottom: -2,
                cursor: isActive ? 'default' : 'pointer',
                position: 'relative',
                zIndex: isActive ? 2 : 1,
                fontFamily: 'Silkscreen,monospace',
                fontSize: isMobile ? 8 : 9,
                letterSpacing: 0.6,
                color: isActive ? 'var(--ink)' : 'var(--muted)',
                userSelect: 'none',
                maxWidth: isMobile ? 160 : 220,
                transition: 'background 80ms, color 80ms',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isActive ? 'var(--amber-deep)' : 'var(--line)',
                  flexShrink: 0,
                }}
              />
              {editingId === b.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="cr-mono"
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    letterSpacing: 'inherit',
                    border: '1px solid var(--line)',
                    background: 'var(--cream-hi)',
                    padding: '1px 4px',
                    width: 140,
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: isActive ? 700 : 500,
                      textTransform: 'uppercase',
                    }}
                  >
                    {b.name || 'Untitled'}
                  </span>
                  <span
                    className="cr-mono"
                    style={{
                      fontSize: 8,
                      color: isActive ? 'var(--ink-soft)' : 'var(--muted)',
                      background: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                      padding: '1px 5px',
                      minWidth: 14,
                      textAlign: 'center',
                      border: isActive ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    {taskCount}
                  </span>
                </>
              )}
              {bundles.length > 1 && editingId !== b.id && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose?.(b.id)
                  }}
                  title="close bundle"
                  style={{
                    width: 14,
                    height: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    fontFamily: 'Inter,sans-serif',
                    fontWeight: 400,
                    borderRadius: 2,
                  }}
                >
                  ×
                </span>
              )}
            </div>
          )
        })}
        <button
          onClick={onAdd}
          title="new empty bundle"
          className="cr-mono"
          style={{
            padding: isMobile ? '5px 10px 6px' : '6px 12px 7px',
            background: 'transparent',
            border: '2px dashed var(--line)',
            borderBottom: '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            fontFamily: 'Silkscreen,monospace',
            fontSize: isMobile ? 9 : 10,
            letterSpacing: 0.6,
            color: 'var(--muted)',
          }}
        >
          ＋ NEW
        </button>
        <div
          style={{
            flex: 1,
            borderBottom: '2px solid var(--line)',
            alignSelf: 'stretch',
            marginBottom: -2,
          }}
        />
      </div>
    </div>
  )
}

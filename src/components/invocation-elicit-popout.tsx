// CrInvocationElicitPopout — schema-driven form for an open Invocation
// Contract `elicit` event (slice 5). Differs from the legacy
// CrHITLPopout: that one is for blocked TASKS, this one is for blocked
// INVOCATIONS — the new path that the krewcli-bridge `delegate` tool
// uses, with full schema rendering (single-line, multi-line, enum
// radio, multi-enum checkboxes, number, boolean).

import { useEffect, useMemo, useState } from 'react'

import type { ResultEnvelope } from '../lib/api/krewhub-client'
import type { PendingElicit } from '../lib/api/invocation-stream'


interface CrInvocationElicitPopoutProps {
  item: PendingElicit | null
  onClose?: () => void
  onSubmit?: (envelope: ResultEnvelope) => void
}

type SchemaProperty = {
  type?: string
  title?: string
  description?: string
  enum?: unknown[]
  oneOf?: Array<{ const: unknown; title?: string }>
  items?: SchemaProperty
  minimum?: number
  maximum?: number
  default?: unknown
}

export function CrInvocationElicitPopout({
  item, onClose, onSubmit,
}: CrInvocationElicitPopoutProps) {
  const properties = useMemo<Record<string, SchemaProperty>>(() => {
    if (!item?.schema) return {}
    const props = (item.schema as Record<string, unknown>).properties
    if (props && typeof props === 'object') return props as Record<string, SchemaProperty>
    return {}
  }, [item?.schema])

  const required = useMemo<string[]>(() => {
    if (!item?.schema) return []
    const req = (item.schema as Record<string, unknown>).required
    return Array.isArray(req) ? (req as string[]) : []
  }, [item?.schema])

  const [values, setValues] = useState<Record<string, unknown>>({})
  // Free-text fallback for schema-less prompts — operator types into a
  // single textarea and the envelope's `content` is the string.
  const [freeText, setFreeText] = useState('')

  useEffect(() => {
    setValues({})
    setFreeText('')
  }, [item?.invocationId])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  if (!item) return null

  const hasSchema = Object.keys(properties).length > 0
  const accent = '#DC2626'
  const bg = '#FEF2F2'

  const canSubmit = hasSchema
    ? required.every((k) => values[k] !== undefined && values[k] !== '')
    : freeText.trim().length > 0

  const handleSubmit = () => {
    const envelope: ResultEnvelope = hasSchema
      ? { action: 'accept', content: values }
      : { action: 'accept', content: freeText }
    onSubmit?.(envelope)
  }

  const handleDecline = () => {
    onSubmit?.({ action: 'decline', reason: 'operator_declined' })
  }

  return (
    <div
      className="cr"
      style={{
        position: 'absolute', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(20,17,10,0.55)', backdropFilter: 'blur(2px)',
        animation: 'cr-fadein 160ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cr-bevel"
        style={{
          width: 'min(480px, 94vw)', maxHeight: '82vh', overflow: 'auto',
          margin: 12, background: 'var(--cream-hi)',
          borderColor: accent, borderWidth: 2,
          boxShadow: `6px 6px 0 ${accent}`,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '10px 14px', borderBottom: `2px solid ${accent}`,
          background: bg, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cr-led red" />
            <span className="cr-kicker" style={{ fontSize: 8, color: accent, letterSpacing: 0.7 }}>
              AGENT REQUESTS INPUT
            </span>
          </div>
          <button
            onClick={onClose}
            className="cr-bevel"
            style={{
              padding: '2px 8px', background: 'var(--cream-hi)',
              fontFamily: 'Silkscreen,monospace', fontSize: 9, cursor: 'pointer',
            }}
          >ESC ✕</button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
            INV {item.invocationId.slice(0, 12)}…
            {item.deadlineTs && (
              <> · DEADLINE {new Date(item.deadlineTs).toLocaleTimeString()}</>
            )}
          </div>
          <div
            className="cr-bevel"
            style={{
              background: 'var(--cream-md)', padding: 10,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <span className="cr-kicker" style={{ fontSize: 8, color: accent }}>
              QUESTION
            </span>
            <div style={{
              fontFamily: 'Inter,sans-serif', fontSize: 14,
              color: 'var(--ink)', lineHeight: 1.4, whiteSpace: 'pre-wrap',
            }}>
              {item.message || '(no message)'}
            </div>
          </div>

          {hasSchema ? (
            <SchemaForm
              properties={properties}
              required={required}
              values={values}
              onChange={setValues}
            />
          ) : (
            <FreeTextField value={freeText} onChange={setFreeText} />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDecline}
              className="cr-bevel"
              style={{
                flex: 1, padding: '10px 12px',
                background: 'var(--cream-hi)',
                fontFamily: 'Silkscreen,monospace', fontSize: 11,
                letterSpacing: 0.6, cursor: 'pointer',
              }}
            >⊘ DECLINE</button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="cr-bevel"
              style={{
                flex: 2, padding: '10px 12px',
                background: canSubmit ? 'var(--amber)' : 'var(--cream-md)',
                color: '#1A1408',
                borderColor: 'var(--amber-deep)',
                fontFamily: 'Silkscreen,monospace', fontSize: 11,
                letterSpacing: 0.6,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '3px 3px 0 var(--amber-deep)' : 'none',
                opacity: canSubmit ? 1 : 0.6,
              }}
            >▸ SEND</button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Schema → form rendering (MCP elicitation subset)
// ---------------------------------------------------------------------------

interface SchemaFormProps {
  properties: Record<string, SchemaProperty>
  required: string[]
  values: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

function SchemaForm({ properties, required, values, onChange }: SchemaFormProps) {
  const setField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(properties).map(([key, prop]) => (
        <FieldFor
          key={key}
          name={key}
          prop={prop}
          required={required.includes(key)}
          value={values[key]}
          onChange={(v) => setField(key, v)}
        />
      ))}
    </div>
  )
}

interface FieldForProps {
  name: string
  prop: SchemaProperty
  required: boolean
  value: unknown
  onChange: (v: unknown) => void
}

function FieldFor({ name, prop, required, value, onChange }: FieldForProps) {
  const label = prop.title ?? name
  const desc = prop.description

  // oneOf with const branches → single-select with display titles
  if (prop.oneOf && prop.oneOf.length > 0) {
    return (
      <FieldShell label={label} desc={desc} required={required}>
        <select
          value={String(value ?? '')}
          onChange={(e) => {
            const branch = prop.oneOf?.find((b) => String(b.const) === e.target.value)
            onChange(branch?.const ?? e.target.value)
          }}
          className="cr-bevel"
          style={{ padding: 8, fontFamily: 'Inter,sans-serif', fontSize: 14 }}
        >
          <option value="">— pick one —</option>
          {prop.oneOf.map((b) => (
            <option key={String(b.const)} value={String(b.const)}>
              {b.title ?? String(b.const)}
            </option>
          ))}
        </select>
      </FieldShell>
    )
  }

  // string + enum → radio buttons
  if (prop.type === 'string' && prop.enum && Array.isArray(prop.enum)) {
    return (
      <FieldShell label={label} desc={desc} required={required}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {prop.enum.map((opt) => (
            <label key={String(opt)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name={name}
                value={String(opt)}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14 }}>{String(opt)}</span>
            </label>
          ))}
        </div>
      </FieldShell>
    )
  }

  // array of enum → checkboxes (multi-select)
  if (prop.type === 'array' && prop.items?.enum) {
    const arr = Array.isArray(value) ? value : []
    const toggle = (opt: unknown) => {
      const next = arr.includes(opt as never)
        ? arr.filter((x) => x !== opt)
        : [...arr, opt]
      onChange(next)
    }
    return (
      <FieldShell label={label} desc={desc} required={required}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {prop.items.enum.map((opt) => (
            <label key={String(opt)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={arr.includes(opt as never)}
                onChange={() => toggle(opt)}
              />
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14 }}>{String(opt)}</span>
            </label>
          ))}
        </div>
      </FieldShell>
    )
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <FieldShell label={label} desc={desc} required={required}>
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={prop.minimum}
          max={prop.maximum}
          step={prop.type === 'integer' ? 1 : 'any'}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? undefined : Number(v))
          }}
          className="cr-bevel"
          style={{ padding: 8, fontFamily: 'Inter,sans-serif', fontSize: 14 }}
        />
      </FieldShell>
    )
  }

  if (prop.type === 'boolean') {
    return (
      <FieldShell label={label} desc={desc} required={required}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14 }}>{label}</span>
        </label>
      </FieldShell>
    )
  }

  // Default: string
  return (
    <FieldShell label={label} desc={desc} required={required}>
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="cr-bevel"
        style={{ padding: 8, fontFamily: 'Inter,sans-serif', fontSize: 14 }}
      />
    </FieldShell>
  )
}

interface FieldShellProps {
  label: string
  desc?: string
  required: boolean
  children: React.ReactNode
}

function FieldShell({ label, desc, required, children }: FieldShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="cr-kicker" style={{ fontSize: 8, color: 'var(--ink-soft)' }}>
        {label.toUpperCase()}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {desc && (
        <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
          {desc}
        </div>
      )}
      {children}
    </div>
  )
}

function FreeTextField({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="cr-kicker" style={{ fontSize: 8, color: 'var(--ink-soft)' }}>
        YOUR ANSWER
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Type your answer…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
          }
        }}
        className="cr-bevel"
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10,
          fontFamily: 'Inter,sans-serif', fontSize: 14,
          color: 'var(--ink)', background: 'var(--cream-md)',
          resize: 'none', outline: 'none',
        }}
      />
      <div className="cr-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
        ⌘↵ to send
      </div>
    </div>
  )
}

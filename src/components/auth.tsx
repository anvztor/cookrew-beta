import { useEffect, useState, type ReactNode } from 'react'
import { CrButton, CrInput } from './atoms/atoms'
import { CR_PORTRAITS, CrSprite } from './atoms/sprite'
import { CrLogo } from './header'
import { detectDeviceInsets } from '../lib/insets'
import type { Variant } from './party-sidebar'

interface CrAuthShellProps {
  variant?: Variant
  children: ReactNode
  kicker: string
  title: string
}

export function CrAuthShell({ variant = 'desktop', children, kicker, title }: CrAuthShellProps) {
  const isMobile = variant === 'mobile'
  const devIns = detectDeviceInsets()

  return (
    <div
      className="cr"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        background: 'var(--cream)',
      }}
    >
      <div
        style={{
          flex: isMobile ? '0 0 auto' : 1,
          background: 'var(--amber)',
          borderRight: isMobile ? 'none' : '2px solid var(--line)',
          borderBottom: isMobile ? '2px solid var(--line)' : 'none',
          padding: isMobile ? '20px 18px' : '40px 36px',
          paddingTop: isMobile
            ? `calc(20px + ${devIns.top}px + env(safe-area-inset-top, 0px))`
            : 40,
          paddingLeft: isMobile
            ? `calc(18px + ${devIns.left}px + env(safe-area-inset-left, 0px))`
            : 36,
          paddingRight: isMobile
            ? `calc(18px + ${devIns.right}px + env(safe-area-inset-right, 0px))`
            : 36,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 12 : 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <CrLogo size={isMobile ? 'md' : 'lg'} tag="BETA" tagTone="phos" />
        <div
          style={{
            fontFamily: 'Inter,sans-serif',
            fontSize: isMobile ? 16 : 24,
            fontWeight: 700,
            color: '#1A1408',
            lineHeight: 1.25,
            maxWidth: 380,
          }}
        >
          A multiplayer kitchen for humans and agents.
        </div>
        {!isMobile && (
          <>
            <div
              className="cr-mono"
              style={{
                fontSize: 12,
                color: 'rgba(26,20,8,0.7)',
                maxWidth: 360,
                lineHeight: 1.5,
              }}
            >
              Bundle work. Spawn a party. Watch them cook.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 30 }}>
              <CrSprite art={CR_PORTRAITS.scout} size={48} bg="rgba(255,255,255,0.4)" />
              <CrSprite art={CR_PORTRAITS.gatekeeper} size={48} bg="rgba(255,255,255,0.4)" />
              <CrSprite art={CR_PORTRAITS.brewer} size={48} bg="rgba(255,255,255,0.4)" />
            </div>
          </>
        )}
      </div>

      <div
        style={{
          flex: 1,
          padding: isMobile ? '24px 20px 32px' : '40px 36px',
          paddingLeft: isMobile
            ? `calc(20px + ${devIns.left}px + env(safe-area-inset-left, 0px))`
            : 36,
          paddingRight: isMobile
            ? `calc(20px + ${devIns.right}px + env(safe-area-inset-right, 0px))`
            : 36,
          paddingBottom: isMobile
            ? `calc(32px + ${devIns.bottom}px + env(safe-area-inset-bottom, 0px))`
            : 36,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'var(--cream)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div className="cr-kicker" style={{ fontSize: 9, marginBottom: 4 }}>{kicker}</div>
            <div className="cr-display" style={{ fontSize: isMobile ? 18 : 22 }}>{title}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function CrAuthDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
      <span className="cr-kicker" style={{ fontSize: 8 }}>OR</span>
      <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
    </div>
  )
}

export type AuthMode = 'signin' | 'signup'

interface AuthFormProps {
  variant?: Variant
  onToggle?: (mode: AuthMode) => void
}

export function CrSignIn({ variant = 'desktop', onToggle }: AuthFormProps) {
  const isMobile = variant === 'mobile'
  return (
    <CrAuthShell variant={variant} kicker="WELCOME BACK" title="SIGN IN">
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cr-kicker" style={{ fontSize: 8 }}>EMAIL</span>
        <CrInput type="email" placeholder="alex@kitchen.dev" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cr-kicker" style={{ fontSize: 8 }}>PASSWORD</span>
        <CrInput type="password" placeholder="••••••••" />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
        <a
          href="#"
          className="cr-mono"
          style={{ fontSize: 11, color: 'var(--ink-soft)', textDecoration: 'underline' }}
        >
          Forgot password?
        </a>
      </div>
      <CrButton variant="primary" block touch={isMobile}>SIGN IN ▶</CrButton>
      <CrAuthDivider />
      <CrButton block touch={isMobile}>▤ CONTINUE WITH GITHUB</CrButton>
      <CrButton block touch={isMobile}>♦ CONTINUE WITH SSO</CrButton>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span className="cr-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          New here?
        </span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onToggle?.('signup')
          }}
          className="cr-display"
          style={{ fontSize: 10, color: 'var(--ink-soft)', textDecoration: 'underline' }}
        >
          CREATE ACCOUNT
        </a>
      </div>
    </CrAuthShell>
  )
}

export function CrSignUp({ variant = 'desktop', onToggle }: AuthFormProps) {
  const isMobile = variant === 'mobile'
  return (
    <CrAuthShell variant={variant} kicker="NEW OPERATOR" title="CREATE ACCOUNT">
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cr-kicker" style={{ fontSize: 8 }}>HANDLE</span>
        <CrInput placeholder="@scout-runner" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cr-kicker" style={{ fontSize: 8 }}>EMAIL</span>
        <CrInput type="email" placeholder="alex@kitchen.dev" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cr-kicker" style={{ fontSize: 8 }}>PASSWORD</span>
        <CrInput type="password" placeholder="8+ characters" />
      </label>
      <CrButton variant="primary" block touch={isMobile}>CREATE ▶</CrButton>
      <CrAuthDivider />
      <CrButton block touch={isMobile}>▤ CONTINUE WITH GITHUB</CrButton>
      <CrButton block touch={isMobile}>♦ CONTINUE WITH SSO</CrButton>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span className="cr-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          Already cooking?
        </span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onToggle?.('signin')
          }}
          className="cr-display"
          style={{ fontSize: 10, color: 'var(--ink-soft)', textDecoration: 'underline' }}
        >
          SIGN IN
        </a>
      </div>
    </CrAuthShell>
  )
}

interface CrAuthProps {
  variant?: Variant
  mode?: AuthMode
  onToggle?: (mode: AuthMode) => void
}

export function CrAuth({ variant = 'desktop', mode = 'signin', onToggle }: CrAuthProps) {
  const [m, setM] = useState<AuthMode>(mode)
  useEffect(() => setM(mode), [mode])
  const toggle = (v: AuthMode) => {
    setM(v)
    onToggle?.(v)
  }
  return m === 'signup' ? (
    <CrSignUp variant={variant} onToggle={toggle} />
  ) : (
    <CrSignIn variant={variant} onToggle={toggle} />
  )
}

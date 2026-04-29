import { useAuth } from '../../lib/auth/useAuth'
import { CrAuthShell } from '../auth'
import { CrButton } from '../atoms/atoms'
import type { Variant } from '../party-sidebar'

interface Props {
  variant?: Variant
}

export function LoginScreen({ variant = 'desktop' }: Props) {
  const { login } = useAuth()
  return (
    <CrAuthShell variant={variant} kicker="WELCOME" title="SIGN IN">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p
          className="cr-mono"
          style={{ fontSize: 12, color: 'var(--ink-soft)' }}
        >
          One passkey for cookrew, krewcli, and all Krew tools.
        </p>
        <CrButton variant="primary" block onClick={() => void login()}>
          SIGN IN WITH PASSKEY ▶
        </CrButton>
      </div>
    </CrAuthShell>
  )
}

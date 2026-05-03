import { useEffect, useState } from 'react'
import { CallbackScreen } from '../components/auth-view/callback-screen'
import { CrEventFeed } from '../components/event-feed'
import { CrFooter } from '../components/footer'
import { CrHeader } from '../components/header'
import { CrMissionBoard } from '../components/mission-board'
import { CrPartySidebar } from '../components/party-sidebar'
import { redirectToLogin } from '../lib/auth/auth-client'
import { useAuth } from '../lib/auth/useAuth'
import { createTask, type Task as ApiTask } from '../lib/api/krewhub-client'

// cookrew-beta is workspace-only. Anon users are redirected to krewauth
// for sign-in; this app never renders a login form. The /auth/callback
// path is the one-shot return point for the OAuth code exchange.

const DEV_BUNDLE_ID =
  (import.meta.env.VITE_KREWHUB_DEV_BUNDLE_ID as string | undefined) ?? 'BUN_DEV1'

export function MobileApp() {
  const { state, logout } = useAuth()
  const [partyOpen, setPartyOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [liveTasks, setLiveTasks] = useState<ApiTask[]>([])
  const [shipError, setShipError] = useState<string | null>(null)

  const handleShip = async ({ text }: { mode: string; text: string }) => {
    const title = text.trim()
    if (!title) return
    try {
      const { task } = await createTask(DEV_BUNDLE_ID, title)
      setLiveTasks((cur) => [...cur, task])
      setActiveTaskId(task.id)
      setFeedOpen(true)
      setShipError(null)
    } catch (e) {
      const err = e as { code?: string; message?: string }
      setShipError(
        err.code === 'no_paired_agent'
          ? 'Hire an agent first'
          : err.message ?? 'Failed to ship',
      )
    }
  }

  // When the auth check finishes and we're anon, kick straight to krewauth.
  // We only fire once per anon transition — redirectToLogin sets
  // window.location, so React re-renders are interrupted by the navigation.
  useEffect(() => {
    if (state.status === 'anon' && window.location.pathname !== '/auth/callback') {
      void redirectToLogin()
    }
  }, [state.status])

  const path = window.location.pathname
  if (path === '/auth/callback') {
    return <CallbackScreen />
  }

  if (state.status === 'loading' || state.status === 'anon') {
    return (
      <div
        style={{
          padding: 32,
          fontFamily: 'Inter,sans-serif',
          background: 'var(--cream)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state.status === 'anon' ? 'Redirecting to sign-in…' : 'Loading…'}
      </div>
    )
  }

  // Authed: workspace.
  const closeDrawers = () => {
    setPartyOpen(false)
    setFeedOpen(false)
  }

  const cls = `cr cr-app${partyOpen ? ' party-open' : ''}${feedOpen ? ' feed-open' : ''}`

  return (
    <div className={cls} data-screen-label="Arcade · Mobile">
      <CrHeader
        variant="mobile"
        partyOpen={partyOpen}
        feedOpen={feedOpen}
        onMenu={() => {
          setFeedOpen(false)
          setPartyOpen((o) => !o)
        }}
        onFeed={() => {
          setPartyOpen(false)
          setFeedOpen((o) => !o)
        }}
        onAvatar={() => void logout()}
      />
      <div className="cr-stage">
        <CrMissionBoard variant="mobile" liveTasks={liveTasks} />
      </div>
      {shipError && (
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--cream-hi, #faf6ec)',
            color: 'crimson',
            fontSize: 12,
            borderTop: '1.5px dashed var(--line-soft)',
          }}
        >
          {shipError}
        </div>
      )}
      <CrFooter variant="mobile" onSend={(p) => void handleShip(p)} />

      <div className="cr-scrim" onClick={closeDrawers} />
      <div className="cr-drawer left">
        <CrPartySidebar variant="mobile" />
      </div>
      <div className="cr-drawer right">
        <CrEventFeed
          variant="mobile"
          taskId={activeTaskId ?? undefined}
          onClose={() => setFeedOpen(false)}
        />
      </div>
    </div>
  )
}

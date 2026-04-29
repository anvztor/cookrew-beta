import { useState } from 'react'
import { CallbackScreen } from '../components/auth-view/callback-screen'
import { LoginScreen } from '../components/auth-view/login-screen'
import { CrEventFeed } from '../components/event-feed'
import { CrFooter } from '../components/footer'
import { CrHeader } from '../components/header'
import { CrMissionBoard } from '../components/mission-board'
import { CrPartySidebar } from '../components/party-sidebar'
import { useAuth } from '../lib/auth/useAuth'
import type { Task as ApiTask } from '../lib/api/krewhub-client'

// Auth track A2 — placeholder current bundle id. Auth track A1 will
// supply this from useAuth() / current-bundle aggregate; for now we
// read from VITE_KREWHUB_DEV_BUNDLE_ID with a fake-auth default.
const DEV_BUNDLE_ID =
  (import.meta.env.VITE_KREWHUB_DEV_BUNDLE_ID as string | undefined) ?? 'BUN_DEV1'

export function MobileApp() {
  const { state, logout } = useAuth()
  const [partyOpen, setPartyOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  // Plain pathname routing — no router lib.
  const path = window.location.pathname
  if (path === '/auth/callback') {
    return <CallbackScreen />
  }

  if (state.status === 'loading') {
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
        Loading…
      </div>
    )
  }

  if (state.status === 'anon') {
    return (
      <div className="cr cr-app" data-screen-label="Auth · Mobile">
        <LoginScreen variant="mobile" />
      </div>
    )
  }

  // Authed: render the workspace. Track A2 mounts mission-composer inside this branch.
  const closeDrawers = () => {
    setPartyOpen(false)
    setFeedOpen(false)
  }

  const cls = `cr cr-app${partyOpen ? ' party-open' : ''}${feedOpen ? ' feed-open' : ''}`

  return (
    <div className={cls} data-screen-label="Arcade · Mobile">
      <CrHeader
        variant="mobile"
        bundle="BUN_4A2C"
        online={4}
        total={5}
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
        <CrMissionBoard
          variant="mobile"
          bundleId={DEV_BUNDLE_ID}
          onTaskCreated={(task: ApiTask) => {
            setActiveTaskId(task.id)
            setFeedOpen(true)
          }}
        />
      </div>
      <CrFooter variant="mobile" />

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

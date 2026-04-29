import { useState } from 'react'
import { CrAuth, type AuthMode } from '../components/auth'
import { CrEventFeed } from '../components/event-feed'
import { CrFooter } from '../components/footer'
import { CrHeader } from '../components/header'
import { CrMissionBoard } from '../components/mission-board'
import { CrPartySidebar } from '../components/party-sidebar'
import { detectDeviceInsets } from '../lib/insets'

type View = 'app' | 'auth'

export function MobileApp() {
  const [view, setView] = useState<View>('app')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [partyOpen, setPartyOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const devIns = detectDeviceInsets()

  if (view === 'auth') {
    return (
      <div className="cr cr-app" data-screen-label="Auth · Mobile">
        <CrAuth variant="mobile" mode={authMode} onToggle={setAuthMode} />
        <button
          onClick={() => setView('app')}
          style={{
            position: 'fixed',
            top: `calc(12px + ${devIns.top}px + env(safe-area-inset-top, 0px))`,
            right: `calc(12px + ${devIns.right}px + env(safe-area-inset-right, 0px))`,
            padding: '6px 10px',
            fontFamily: 'Silkscreen,monospace',
            fontSize: 9,
            border: '2px solid var(--line)',
            background: 'var(--cream-hi)',
            boxShadow: '2px 2px 0 var(--line)',
            zIndex: 100,
            cursor: 'pointer',
          }}
        >
          ← BACK
        </button>
      </div>
    )
  }

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
        onAvatar={() => setView('auth')}
      />
      <div className="cr-stage">
        <CrMissionBoard variant="mobile" />
      </div>
      <CrFooter variant="mobile" />

      <div className="cr-scrim" onClick={closeDrawers} />
      <div className="cr-drawer left">
        <CrPartySidebar variant="mobile" />
      </div>
      <div className="cr-drawer right">
        <CrEventFeed variant="mobile" onClose={() => setFeedOpen(false)} />
      </div>
    </div>
  )
}

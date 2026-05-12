import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MobileApp } from './app/MobileApp'
import { AuthProvider } from './lib/auth/useAuth'
import './styles/tokens.css'
import './styles/agent-html.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root element missing from index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <MobileApp />
    </AuthProvider>
  </StrictMode>,
)

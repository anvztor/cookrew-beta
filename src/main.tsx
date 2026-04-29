import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MobileApp } from './app/MobileApp'
import './styles/tokens.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root element missing from index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
)

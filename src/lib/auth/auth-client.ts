// PKCE-based auth client. Talks to krewauth (token issuer) for the redirect
// flow and to krewhub (relying party) for /me + /auth/logout.
import { challengeFromVerifier, generateVerifier } from './pkce'

const KREWAUTH = (import.meta.env.VITE_KREWAUTH_URL as string | undefined) ?? 'http://localhost:8421'
const KREWHUB = (import.meta.env.VITE_KREWHUB_URL as string | undefined) ?? 'http://localhost:8420'
const CLIENT_ID = 'cookrew-beta'

const VERIFIER_KEY = 'krewauth_pkce_verifier'
const STATE_KEY = 'krewauth_pkce_state'

function getRedirectUri(): string {
  return `${window.location.origin}/auth/callback`
}

export async function redirectToLogin(): Promise<void> {
  const verifier = generateVerifier()
  const challenge = await challengeFromVerifier(verifier)
  const state = generateVerifier().slice(0, 16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const url = new URL(`${KREWAUTH}/oauth/authorize`)
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  window.location.href = url.toString()
}

export async function exchangeCode(code: string, state: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const expected = sessionStorage.getItem(STATE_KEY)
  if (!verifier) throw new Error('missing_verifier')
  if (state !== expected) throw new Error('bad_state')
  const r = await fetch(`${KREWAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!r.ok) throw new Error(`token_exchange_failed_${r.status}`)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
}

export interface Account {
  account_id: string
  auth_method: string
  username?: string | null
}

export async function me(): Promise<Account | null> {
  const r = await fetch(`${KREWHUB}/me`, { credentials: 'include' })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`me_failed_${r.status}`)
  return r.json()
}

export async function logout(): Promise<void> {
  await fetch(`${KREWHUB}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

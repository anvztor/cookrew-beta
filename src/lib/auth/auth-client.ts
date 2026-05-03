// OAuth2 + PKCE auth client. cookrew-beta redirects to krewauth's hosted
// login page (auth.cookrew.dev) for sign-in; krewauth issues an auth code
// which we exchange for a httpOnly session cookie on .cookrew.dev.

import { challengeFromVerifier, generateVerifier } from './pkce'

const KREWAUTH = (import.meta.env.VITE_KREWAUTH_URL as string | undefined) ?? 'http://localhost:8421'
const KREWHUB = (import.meta.env.VITE_KREWHUB_URL as string | undefined) ?? 'http://localhost:8420'
const CLIENT_ID = 'cookrew-beta'

const VERIFIER_KEY = 'krewauth_pkce_verifier'
const STATE_KEY = 'krewauth_pkce_state'
const RETURN_TO_KEY = 'krewauth_return_to'

function getRedirectUri(): string {
  return `${window.location.origin}/auth/callback`
}

export interface Account {
  account_id: string
  auth_method: string
  username?: string | null
}

export async function redirectToLogin(): Promise<void> {
  const verifier = generateVerifier()
  const challenge = await challengeFromVerifier(verifier)
  const state = generateVerifier().slice(0, 16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  // Stash the path to return to so the callback lands back on the same page.
  const here = window.location.pathname + window.location.search + window.location.hash
  if (here && here !== '/auth/callback') {
    sessionStorage.setItem(RETURN_TO_KEY, here)
  }

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

export function consumeReturnTo(): string {
  const v = sessionStorage.getItem(RETURN_TO_KEY) ?? '/'
  sessionStorage.removeItem(RETURN_TO_KEY)
  return v
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

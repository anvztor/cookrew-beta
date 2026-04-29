import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { logout as logoutApi, me as fetchMe, redirectToLogin, type Account } from './auth-client'

type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; account: Account }

interface AuthCtx {
  state: AuthState
  login: () => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const acc = await fetchMe()
      setState(acc ? { status: 'authed', account: acc } : { status: 'anon' })
    } catch {
      setState({ status: 'anon' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async () => {
    await redirectToLogin()
  }, [])

  const logout = useCallback(async () => {
    await logoutApi()
    setState({ status: 'anon' })
  }, [])

  return (
    <Ctx.Provider value={{ state, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside <AuthProvider>')
  return v
}

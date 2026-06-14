import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearStoredAuth, getStoredRefreshToken, getStoredToken, setTokenProvider, setUnauthorizedHandler, storeRefreshToken, storeToken, setRefreshHandler } from '../api/client'
import { refreshToken as refreshAccessToken, getCurrentUser } from '../api/auth'
import { getTokenUser, isTokenExpired } from './token'

const AuthContext = createContext(null)

function readInitialAuth() {
  const url = new URL(window.location.href)
  const tokenFromUrl = url.searchParams.get('token') || url.searchParams.get('accessToken') || url.searchParams.get('jwt')
  const refreshTokenFromUrl = url.searchParams.get('refreshToken')

  if (tokenFromUrl) {
    storeToken(tokenFromUrl)
    if (refreshTokenFromUrl) storeRefreshToken(refreshTokenFromUrl)
    url.searchParams.delete('token')
    url.searchParams.delete('accessToken')
    url.searchParams.delete('jwt')
    url.searchParams.delete('refreshToken')
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  }

  const token = tokenFromUrl || getStoredToken()

  if (!token || isTokenExpired(token)) {
    clearStoredAuth()
    return { token: null, user: null, status: 'unauthenticated' }
  }

  return { token, user: getTokenUser(token), status: 'authenticated' }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({ token: null, user: null, status: 'loading', reason: null }))

  const setSession = useCallback((sessionData) => {
    if (!sessionData) {
      clearStoredAuth()
      setAuth({ token: null, user: null, status: 'unauthenticated', reason: 'cleared' })
      return
    }

    const token = sessionData.accessToken || sessionData.token
    if (!token || isTokenExpired(token)) {
      clearStoredAuth()
      setAuth({ token: null, user: null, status: 'unauthenticated', reason: 'expired' })
      return
    }

    storeToken(token)
    if (sessionData.refreshToken) storeRefreshToken(sessionData.refreshToken)
    
    const user = sessionData.user || getTokenUser(token)
    setAuth({ token, user, status: 'authenticated', reason: null })
  }, [])

  const signOut = useCallback((reason = null) => {
    clearStoredAuth()
    setAuth({ token: null, user: null, status: 'unauthenticated', reason })
  }, [])

  const refreshSession = useCallback(async () => {
    const refreshToken = getStoredRefreshToken()
    if (!refreshToken) {
      signOut('expired')
      return null
    }

    const session = await refreshAccessToken(refreshToken)
    const nextToken = session.accessToken || session.token
    setSession(session)
    return nextToken
  }, [setSession, signOut])

  useEffect(() => {
    setTokenProvider(() => getStoredToken())
    setUnauthorizedHandler(() => signOut('expired'))
    setRefreshHandler(refreshSession)
    setAuth({ ...readInitialAuth(), reason: null })

    const onStorage = (event) => {
      if (event.key !== 'momentum-token') return
      const token = getStoredToken()
      if (!token || isTokenExpired(token)) signOut('expired')
      else setAuth({ token, user: getTokenUser(token), status: 'authenticated', reason: null })
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [signOut, refreshSession])

  useEffect(() => {
    if (auth.status !== 'loading') return

    async function initializeAuth() {
      const initial = readInitialAuth()
      
      if (initial.status === 'authenticated') {
        try {
          const userData = await getCurrentUser()
          setAuth({ 
            token: initial.token, 
            user: userData, 
            status: 'authenticated', 
            reason: null 
          })
        } catch (err) {
          console.error('Failed to fetch current user:', err)
          setAuth(initial)
        }
      } else {
        setAuth(initial)
      }
    }

    initializeAuth()
  }, [])

  useEffect(() => {
    if (!auth.token || auth.status !== 'authenticated') return undefined

    const timer = setInterval(() => {
      if (isTokenExpired(auth.token)) signOut('expired')
    }, 30000)

    return () => clearInterval(timer)
  }, [auth.token, auth.status, signOut])

  const value = useMemo(() => ({
    ...auth,
    isLoading: auth.status === 'loading',
    isAuthenticated: auth.status === 'authenticated',
    setSession,
    refreshSession,
    signOut,
  }), [auth, refreshSession, setSession, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

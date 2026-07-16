import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearStoredAuth, getStoredRefreshToken, getStoredToken, setTokenProvider, setUnauthorizedHandler, storeRefreshToken, storeToken, setRefreshHandler } from '../api/client'
import { refreshToken as refreshAccessToken, getCurrentUser } from '../api/auth'
import { getTokenUser, isTokenExpired, isTokenExpiringSoon } from './token'

const AuthContext = createContext(null)

// Renew the access token this long before it actually expires, so a request
// never goes out holding a token that lapses in transit.
const REFRESH_LEAD_MS = 2 * 60 * 1000
const REFRESH_CHECK_INTERVAL_MS = 30 * 1000

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
  const refreshToken = getStoredRefreshToken()

  if (token && !isTokenExpired(token)) {
    return { token, user: getTokenUser(token), status: 'authenticated', needsRefresh: false }
  }

  // The access token is short-lived (15m) but the refresh token behind it is
  // good for 30 days. An aged-out access token therefore says nothing about
  // whether the session is over — redeem the refresh token instead. Clearing
  // it here (as this used to) threw away a live session on the first reload
  // after 15 minutes, which is why logins never survived a refresh/restart.
  if (refreshToken && !isTokenExpired(refreshToken)) {
    return { token: null, user: null, status: 'loading', needsRefresh: true }
  }

  clearStoredAuth()
  return { token: null, user: null, status: 'unauthenticated', needsRefresh: false }
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

  // Merges partial fields (e.g. a fresh notificationPreferences after a
  // Settings change) into the current user without a full re-login/refetch.
  const updateUser = useCallback((partialUser) => {
    setAuth((current) => (current.user ? { ...current, user: { ...current.user, ...partialUser } } : current))
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

    // Cross-tab sync. Note a sibling tab rotating its access token fires this
    // too, so "the token changed" must not be read as "the session ended" —
    // only the tokens actually being gone means someone signed out.
    const onStorage = (event) => {
      if (event.key !== 'momentum-token') return

      const token = getStoredToken()
      if (!token) {
        if (!getStoredRefreshToken()) signOut('cleared')
        return
      }
      if (isTokenExpired(token)) return

      // Keep the existing user object: it came from /auth/me and carries
      // username/email, whereas getTokenUser only yields {id, githubId} —
      // overwriting it blanks the avatar into the "?" ghost-session state.
      setAuth((current) => ({
        ...current,
        token,
        user: current.user || getTokenUser(token),
        status: 'authenticated',
        reason: null,
      }))
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [signOut, refreshSession])

  useEffect(() => {
    if (auth.status !== 'loading') return

    async function initializeAuth() {
      const initial = readInitialAuth()

      if (initial.needsRefresh) {
        // Access token aged out while away, but the refresh token is still
        // live — redeem it so the session survives reloads and restarts.
        try {
          await refreshSession()
        } catch (err) {
          // Only a refusal means the session is really over; a network blip
          // must not sign the user out and discard a valid refresh token.
          if (err?.status === 401) signOut('expired')
          else setAuth({ token: null, user: null, status: 'unauthenticated', reason: null })
          return
        }
      } else if (initial.status !== 'authenticated') {
        setAuth({ token: null, user: null, status: 'unauthenticated', reason: null })
        return
      }

      try {
        const userData = await getCurrentUser()
        setAuth({
          token: getStoredToken(),
          user: userData,
          status: 'authenticated',
          reason: null,
        })
      } catch (err) {
        // The token verified as well-formed but the backend rejected it. A
        // 401/404 means it points at nothing real (e.g. deleted account,
        // wiped dev DB): falling back to the token-only placeholder would
        // leave the app stuck "authenticated" with a user that has no
        // username/email (see token.js getTokenUser) — the "?" ghost session.
        // Anything else (offline, backend down) is transient and must not
        // destroy a valid stored session.
        console.error('Failed to fetch current user:', err)
        if (err?.status === 401 || err?.status === 404) signOut('invalid')
        else setAuth({ token: null, user: null, status: 'unauthenticated', reason: null })
      }
    }

    initializeAuth()
  }, [signOut, refreshSession])

  useEffect(() => {
    if (auth.status !== 'authenticated') return undefined

    // The access token is short-lived by design (15m) and the refresh token
    // behind it lasts 30 days, so keeping someone signed in just means
    // redeeming the latter before the former lapses. Renew EARLY rather than
    // on expiry: waiting until it has already expired leaves a gap where
    // in-flight requests 401.
    let inFlight = false

    const renewIfNeeded = async () => {
      if (inFlight) return
      const token = getStoredToken()
      if (token && !isTokenExpiringSoon(token, REFRESH_LEAD_MS)) return

      inFlight = true
      try {
        await refreshSession()
      } catch (err) {
        // Only a rejected refresh token ends the session. Anything else
        // (offline, server hiccup) leaves it intact to retry on the next tick.
        if (err?.status === 401) signOut('expired')
      } finally {
        inFlight = false
      }
    }

    // Timers are throttled in background tabs, so a tab left open for hours
    // can come back with a long-expired token — re-check on the way back in.
    const onFocus = () => renewIfNeeded()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') renewIfNeeded()
    }

    const timer = setInterval(renewIfNeeded, REFRESH_CHECK_INTERVAL_MS)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [auth.status, signOut, refreshSession])

  const value = useMemo(() => ({
    ...auth,
    isLoading: auth.status === 'loading',
    isAuthenticated: auth.status === 'authenticated',
    setSession,
    refreshSession,
    signOut,
    updateUser,
  }), [auth, refreshSession, setSession, signOut, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null

  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))

    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false

  return payload.exp * 1000 <= Date.now()
}

// True once `token` is within `withinMs` of expiring (or already expired), so
// a session can be renewed *before* it lapses instead of after — waiting for
// actual expiry leaves a window where in-flight requests fail with a 401.
export function isTokenExpiringSoon(token, withinMs = 0) {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false

  return payload.exp * 1000 - Date.now() <= withinMs
}

export function getTokenUser(token) {
  const payload = decodeJwtPayload(token)
  if (!payload) return null

  return {
    id: payload.userId || payload.sub || null,
    githubId: payload.githubId || null,
  }
}

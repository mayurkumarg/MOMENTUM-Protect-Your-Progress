const TOKEN_KEY = 'momentum-token'
const REFRESH_TOKEN_KEY = 'momentum-refresh-token'

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  return `${window.location.origin}/api`
}

let tokenProvider = () => localStorage.getItem(TOKEN_KEY)
let unauthorizedHandler = () => {}
let refreshHandler = null

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function setTokenProvider(provider) {
  tokenProvider = provider
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function setRefreshHandler(handler) {
  refreshHandler = handler
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  
  // Sync with Momentum browser extension if installed
  window.postMessage({ type: 'MOMENTUM_AUTH_SYNC', token: token || null, refreshToken: getStoredRefreshToken() }, '*')
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
  else localStorage.removeItem(REFRESH_TOKEN_KEY)
  
  // Sync with Momentum browser extension if installed
  window.postMessage({ type: 'MOMENTUM_AUTH_SYNC', token: getStoredToken(), refreshToken: token || null }, '*')
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  
  // Sync with Momentum browser extension if installed
  window.postMessage({ type: 'MOMENTUM_AUTH_SYNC', token: null, refreshToken: null }, '*')
}

function buildUrl(path, params) {
  const baseUrl = getApiBaseUrl()
  
  // Validate baseUrl is not empty or invalid
  if (!baseUrl) {
    throw new Error('API base URL is not configured. Check VITE_API_BASE_URL environment variable.')
  }
  
  // If baseUrl is relative (development mode), convert to absolute
  let absoluteUrl = baseUrl
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    absoluteUrl = `${window.location.origin}${baseUrl}`
  }
  
  // Build complete URL
  const fullUrl = `${absoluteUrl}${path}`
  
  // Validate URL can be constructed
  let url
  try {
    url = new URL(fullUrl)
  } catch (err) {
    throw new Error(`Invalid API URL: "${fullUrl}". Error: ${err.message}`)
  }
  
  // Add query parameters
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  
  return url.toString()
}

async function parseResponse(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

let isRefreshing = false
let refreshPromise = null

// Resolves { ok, unauthorized }. `unauthorized` is only true when the server
// actually rejected the refresh token — a network failure must not be read as
// "session over" and log the user out.
async function refreshAccessToken() {
  if (isRefreshing) return refreshPromise

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      if (!refreshHandler) return { ok: false, unauthorized: true }
      await refreshHandler()
      return { ok: true, unauthorized: false }
    } catch (err) {
      return { ok: false, unauthorized: err instanceof ApiError && err.status === 401 }
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function apiRequest(path, { method = 'GET', params, body, headers = {}, auth = true, isRetry = false } = {}) {
  try {
    const token = tokenProvider()
    const url = buildUrl(path, params)
    
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const payload = await parseResponse(response)

    if (!response.ok) {
      // `isRetry` stops a token that 401s even when freshly minted from
      // looping refresh → retry → refresh forever.
      if (response.status === 401 && auth && !isRetry) {
        const { ok, unauthorized } = await refreshAccessToken()
        if (ok) {
          return apiRequest(path, { method, params, body, headers, auth, isRetry: true })
        }
        if (unauthorized) {
          unauthorizedHandler(new ApiError('Unauthorized', { status: 401, details: payload }))
        }
      }

      const message = payload?.message || payload?.error || 'Momentum could not complete that request.'
      throw new ApiError(message, { status: response.status, details: payload })
    }

    return payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      // fetch() itself failed — offline, DNS failure, backend unreachable, etc.
      throw new ApiError("Momentum couldn't reach the server. Check your connection and try again.", { details: err })
    }
    throw new ApiError(err.message || 'Failed to make API request', { details: err })
  }
}

export { getApiBaseUrl, TOKEN_KEY, REFRESH_TOKEN_KEY }

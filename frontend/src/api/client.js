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

async function refreshAccessToken() {
  if (isRefreshing) return refreshPromise

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      if (!refreshHandler) return false
      await refreshHandler()
      return true
    } catch {
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function apiRequest(path, { method = 'GET', params, body, headers = {}, auth = true } = {}) {
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
      if (response.status === 401 && auth) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          const newToken = tokenProvider()
          return apiRequest(path, { method, params, body, headers, auth })
        }
        unauthorizedHandler(new ApiError('Unauthorized', { status: 401, details: payload }))
      }

      const message = payload?.message || payload?.error || 'Momentum could not complete that request.'
      throw new ApiError(message, { status: response.status, details: payload })
    }

    return payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(err.message || 'Failed to make API request', { details: err })
  }
}

export { getApiBaseUrl, TOKEN_KEY, REFRESH_TOKEN_KEY }

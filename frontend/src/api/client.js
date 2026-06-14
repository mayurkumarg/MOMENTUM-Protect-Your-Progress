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

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
  else localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

function buildUrl(path, params) {
  const url = new URL(`${getApiBaseUrl()}${path}`)
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

export async function apiRequest(path, { method = 'GET', params, body, headers = {}, auth = true } = {}) {
  const token = tokenProvider()
  const response = await fetch(buildUrl(path, params), {
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
    const message = payload?.message || payload?.error || 'Momentum could not complete that request.'
    const error = new ApiError(message, { status: response.status, details: payload })

    if (response.status === 401) {
      unauthorizedHandler(error)
    }

    throw error
  }

  return payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
}

export { getApiBaseUrl, TOKEN_KEY, REFRESH_TOKEN_KEY }

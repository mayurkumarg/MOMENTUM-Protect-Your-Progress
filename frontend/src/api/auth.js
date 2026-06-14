import { apiRequest } from './client'

export function getGithubLoginUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  const params = new URLSearchParams({
    source: 'web',
    returnTo: '/overview',
  })
  return `${baseUrl}/auth/github?${params.toString()}`
}

export function refreshToken(refreshToken) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    auth: false,
    body: { refreshToken },
  })
}

import { apiRequest } from './client'

export function getGithubLoginUrl() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  const params = new URLSearchParams({
    source: 'web',
    returnTo: '/auth/github/callback',
  })
  return `${baseUrl}/auth/github?${params.toString()}`
}

export function registerUser(email, username, password, confirmPassword) {
  return apiRequest('/auth/register', {
    method: 'POST',
    auth: false,
    body: { email, username, password, confirmPassword },
  })
}

export function loginUser(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
}

export function refreshToken(refreshToken) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    auth: false,
    body: { refreshToken },
  })
}

export function logoutUser() {
  return apiRequest('/auth/logout', {
    method: 'POST',
    auth: true,
  })
}

export function getCurrentUser() {
  return apiRequest('/auth/me', {
    method: 'GET',
    auth: true,
  })
}

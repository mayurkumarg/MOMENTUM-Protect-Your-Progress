import { apiRequest } from './client'

export function getGithubStatus() {
  return apiRequest('/github/status')
}

export function listGithubRepos() {
  return apiRequest('/github/repos')
}

export function createGithubRepo({ name, description, isPrivate }) {
  return apiRequest('/github/repos', {
    method: 'POST',
    body: { name, description, isPrivate },
  })
}

export function connectGithubRepo({ owner, name }) {
  return apiRequest('/github/repo/select', {
    method: 'POST',
    body: { owner, name },
  })
}

export function disconnectGithub() {
  return apiRequest('/github/disconnect', { method: 'DELETE' })
}

export function getGithubActivityDashboard() {
  return apiRequest('/github/activity')
}

export function retryGithubSync(activityId) {
  return apiRequest(`/github/activity/${activityId}/retry`, { method: 'POST' })
}

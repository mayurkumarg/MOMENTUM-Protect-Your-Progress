import { apiRequest } from './client'

export function getActivities(params = {}) {
  return apiRequest('/activities', { params: { limit: 100, ...params } })
}

export function createActivity(activity) {
  return apiRequest('/activities', { method: 'POST', body: activity })
}

export function updateActivity(id, updates) {
  return apiRequest(`/activities/${id}`, { method: 'PATCH', body: updates })
}

export function deleteActivity(id) {
  return apiRequest(`/activities/${id}`, { method: 'DELETE' })
}

import { apiRequest } from './client'

export function getTasks(params = {}) {
  return apiRequest('/tasks', { params: { limit: 100, ...params } })
}

export function createTask(task) {
  return apiRequest('/tasks', { method: 'POST', body: task })
}

export function updateTask(id, updates) {
  return apiRequest(`/tasks/${id}`, { method: 'PATCH', body: updates })
}

export function deleteTask(id) {
  return apiRequest(`/tasks/${id}`, { method: 'DELETE' })
}

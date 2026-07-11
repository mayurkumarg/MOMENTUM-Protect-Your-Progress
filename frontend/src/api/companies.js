import { apiRequest } from './client'

export function listCompanies() {
  return apiRequest('/companies')
}

export function createCompany(company) {
  return apiRequest('/companies', { method: 'POST', body: company })
}

export function getCompany(id) {
  return apiRequest(`/companies/${id}`)
}

export function updateCompany(id, updates) {
  return apiRequest(`/companies/${id}`, { method: 'PATCH', body: updates })
}

export function deleteCompany(id) {
  return apiRequest(`/companies/${id}`, { method: 'DELETE' })
}

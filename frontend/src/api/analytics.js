import { apiRequest } from './client'

export function getAnalyticsSummary() {
  return apiRequest('/analytics/summary')
}

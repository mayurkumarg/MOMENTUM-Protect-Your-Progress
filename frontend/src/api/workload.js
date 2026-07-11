import { apiRequest } from './client'

export function getWorkloadSummary() {
  return apiRequest('/workload/summary')
}

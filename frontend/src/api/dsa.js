import { apiRequest } from './client'

export function getDsaSummary() {
  return apiRequest('/dsa/summary')
}

import { useCallback, useMemo } from 'react'
import { analyticsApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useAnalyticsSummary() {
  const auth = useAuth()
  const loader = useCallback(() => analyticsApi.getAnalyticsSummary(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: null })
  const summary = useMemo(() => query.data || null, [query.data])

  return {
    ...query,
    summary,
  }
}

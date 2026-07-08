import { useCallback, useMemo } from 'react'
import { workloadApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useWorkload() {
  const auth = useAuth()
  const loader = useCallback(() => workloadApi.getWorkloadSummary(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: null })
  const summary = useMemo(() => query.data || null, [query.data])

  return {
    ...query,
    summary,
  }
}

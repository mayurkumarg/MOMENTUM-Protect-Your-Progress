import { useCallback, useMemo } from 'react'
import { dsaApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useDsaSummary() {
  const auth = useAuth()
  const loader = useCallback(() => dsaApi.getDsaSummary(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: null })
  const summary = useMemo(() => query.data || null, [query.data])

  return {
    ...query,
    summary,
  }
}

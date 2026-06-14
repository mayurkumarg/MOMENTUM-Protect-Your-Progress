import { useCallback, useMemo } from 'react'
import { activityApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useActivities(params = {}) {
  const auth = useAuth()
  const loader = useCallback(() => activityApi.getActivities(params), [JSON.stringify(params)])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: { activities: [], pagination: null } })
  const activities = useMemo(() => query.data?.activities || [], [query.data])

  return {
    ...query,
    activities,
  }
}

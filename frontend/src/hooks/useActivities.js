import { useCallback, useMemo, useState } from 'react'
import { activityApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useActivities(params = {}) {
  const auth = useAuth()
  const [mutationError, setMutationError] = useState(null)
  const loader = useCallback(() => activityApi.getActivities(params), [JSON.stringify(params)])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: { activities: [], pagination: null } })
  const activities = useMemo(() => query.data?.activities || [], [query.data])

  const addActivity = useCallback(async (activity) => {
    setMutationError(null)
    const created = await activityApi.createActivity(activity)
    query.setData((current) => ({
      ...(current || {}),
      activities: [created, ...(current?.activities || [])],
    }))
    return created
  }, [query])

  const removeActivity = useCallback(async (id) => {
    setMutationError(null)
    const previous = query.data
    query.setData((current) => ({
      ...(current || {}),
      activities: (current?.activities || []).filter((activity) => activity.id !== id),
    }))

    try {
      return await activityApi.deleteActivity(id)
    } catch (error) {
      query.setData(previous)
      setMutationError(error)
      throw error
    }
  }, [query])

  return {
    ...query,
    activities,
    error: query.error || mutationError,
    addActivity,
    removeActivity,
  }
}

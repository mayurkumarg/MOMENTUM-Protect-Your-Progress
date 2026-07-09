import { useCallback } from 'react'
import { githubApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

export function useGithubActivity() {
  const auth = useAuth()
  const loader = useCallback(() => githubApi.getGithubActivityDashboard(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: null })

  return {
    ...query,
    dashboard: query.data,
  }
}

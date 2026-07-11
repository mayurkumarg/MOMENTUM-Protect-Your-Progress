import { useCallback, useMemo } from 'react'
import { githubApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from './useAsyncData'

const EMPTY_STATUS = { connected: false, githubUsername: null, githubAvatar: null, connectedAt: null, repository: null }

export function useGithubIntegration() {
  const auth = useAuth()
  const loader = useCallback(() => githubApi.getGithubStatus(), [])
  const query = useAsyncData(loader, { enabled: auth.isAuthenticated, initialData: null })
  const status = useMemo(() => query.data || EMPTY_STATUS, [query.data])

  return {
    ...query,
    status,
  }
}

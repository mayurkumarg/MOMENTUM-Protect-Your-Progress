import { useCallback, useState } from 'react'
import { authApi } from '../api'
import { useToast } from '../components/ToastProvider'

// Starts the GitHub repo-access OAuth grant from wherever the user currently
// is (Analytics, the GitHub dashboard, Settings, ...) instead of forcing a
// trip to Settings first. `returnTo` is where the OAuth callback sends them
// back to once it's done — see useGithubOAuthReturn for the other half.
export function useGithubConnect(returnTo) {
  const toast = useToast()
  const [connecting, setConnecting] = useState(false)

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      const { url } = await authApi.getGithubConnectUrl(returnTo)
      window.location.href = url
    } catch (error) {
      toast.error(error.message || 'Could not start GitHub connection.')
      setConnecting(false)
    }
  }, [returnTo, toast])

  return { connecting, connect }
}

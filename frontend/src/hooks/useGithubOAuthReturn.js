import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'

// Consumes the `?github=connected|error` query params the OAuth callback
// appends when it lands back on the page the user started from, shows a
// toast, cleans the URL, and (on success) lets the page refresh its own
// GitHub-dependent data without the user having to do anything.
export function useGithubOAuthReturn(onConnected) {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const result = searchParams.get('github')
    if (!result) return

    if (result === 'connected') {
      toast.success('GitHub connected.')
      onConnected?.()
    } else if (result === 'error') {
      toast.error(searchParams.get('message') || 'GitHub connection failed.')
    }

    const next = new URLSearchParams(searchParams)
    next.delete('github')
    next.delete('message')
    setSearchParams(next, { replace: true })
    // Runs once per mount to consume the OAuth redirect query params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

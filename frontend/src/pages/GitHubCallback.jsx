import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoaderCircle, AlertCircle } from 'lucide-react'
import { Card, Button } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

export default function GitHubCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function handleCallback() {
      try {
        const token = searchParams.get('token') || searchParams.get('accessToken') || searchParams.get('jwt')
        const refreshToken = searchParams.get('refreshToken')
        const errorParam = searchParams.get('error')

        if (errorParam) {
          setError(errorParam || 'GitHub login failed. Please try again.')
          setLoading(false)
          return
        }

        if (!token) {
          setError('No authentication token received. Please try again.')
          setLoading(false)
          return
        }

        setSession({ accessToken: token, refreshToken })
        navigate('/overview')
      } catch (err) {
        setError(err.message || 'Failed to complete GitHub login')
        setLoading(false)
      }
    }

    handleCallback()
  }, [searchParams, setSession, navigate])

  if (loading && !error) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
        <Card className="flex flex-col items-center gap-4 p-6">
          <LoaderCircle className="animate-spin text-accent" size={32} />
          <span className="text-sm text-muted">Completing your login...</span>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
        <Card className="w-full max-w-md space-y-4 p-6">
          <div className="flex gap-3">
            <AlertCircle className="size-6 shrink-0 text-coral" />
            <div>
              <h2 className="font-semibold text-ink">Login Failed</h2>
              <p className="mt-1 text-sm text-muted">{error}</p>
            </div>
          </div>
          <Button onClick={() => navigate('/login')} className="w-full">
            Back to Login
          </Button>
        </Card>
      </div>
    )
  }

  return null
}

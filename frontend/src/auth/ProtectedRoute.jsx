import { Github, LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getGithubLoginUrl } from '../api/auth'
import { Button, Card } from '../components/ui'
import { useAuth } from './AuthProvider'

export default function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
        <Card className="flex items-center gap-3 p-5 text-muted">
          <LoaderCircle className="animate-spin" size={18} />
          <span className="text-sm">Checking your session</span>
        </Card>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function LoginRoute() {
  const auth = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/overview'

  if (auth.isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <Card className="w-full max-w-md p-6">
        <p className="eyebrow">Momentum</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Momentum needs your authenticated backend session before it can load tasks and activity.
        </p>
        {auth.reason === 'expired' && (
          <div className="mt-5 rounded-md border border-coral bg-coral-soft px-3 py-2 text-sm text-coral">
            Your session expired. Sign in again to keep working.
          </div>
        )}
        <Button icon={Github} className="mt-6 w-full" onClick={() => { window.location.href = getGithubLoginUrl() }}>
          Continue with GitHub
        </Button>
      </Card>
    </div>
  )
}

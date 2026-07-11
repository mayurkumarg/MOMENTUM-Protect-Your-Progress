import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { Card } from '../components/ui'
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

export function LoginRoute({ children }) {
  const auth = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/overview'

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

  if (auth.isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return children
}

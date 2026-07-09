import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Eye, EyeOff, Github, Loader, AlertCircle, Info } from 'lucide-react'
import { Button } from '../components/ui'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthProvider'
import { validateLogin } from '../auth/validation'
import { getGithubLoginUrl } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { setSession, reason } = useAuth()

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Check for GitHub OAuth error in URL
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setServerError(error)
    }
  }, [searchParams])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (serverError) setServerError('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrors({})
    setServerError('')

    const validation = validateLogin(formData.email, formData.password)
    if (validation) {
      setErrors({ [validation.field]: validation.message })
      return
    }

    setLoading(true)
    try {
      const { loginUser } = await import('../api/auth')
      const response = await loginUser(formData.email, formData.password)

      setSession(response)
      const returnTo = location.state?.from?.pathname || searchParams.get('returnTo') || '/overview'
      navigate(returnTo, { replace: true })
    } catch (err) {
      setServerError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const githubUrl = getGithubLoginUrl()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <Logo size={48} />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Welcome back</h1>
            <p className="text-sm text-muted">Sign in to your Momentum account</p>
          </div>
        </div>

        {reason === 'expired' && !serverError && (
          <div className="flex gap-3 rounded-lg border border-line bg-surface-subtle p-3">
            <Info className="size-5 shrink-0 text-muted" />
            <p className="text-sm text-muted">Your session expired. Please sign in again.</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-5 text-muted" />
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`w-full rounded-lg border border-line bg-canvas pl-10 pr-3 py-2.5 text-sm placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                  errors.email ? 'border-coral' : ''
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-coral">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`w-full rounded-lg border border-line bg-canvas px-3 py-2.5 pr-10 text-sm placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                  errors.password ? 'border-coral' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-coral">{errors.password}</p>}
          </div>

          {serverError && (
            <div className="flex gap-3 rounded-lg border border-coral/20 bg-coral/5 p-3">
              <AlertCircle className="size-5 shrink-0 text-coral" />
              <p className="text-sm text-coral">{serverError}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader className="mr-2 animate-spin" size={16} />}
            {loading ? 'Signing in...' : 'Sign in with Email'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-canvas px-2 text-muted">Or continue with</span>
          </div>
        </div>

        <a href={githubUrl}>
          <Button type="button" variant="secondary" className="w-full hover:opacity-90 transition-opacity">
            <Github size={18} className="mr-2" />
            Continue with GitHub
          </Button>
        </a>

        <p className="text-center text-sm text-muted">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}

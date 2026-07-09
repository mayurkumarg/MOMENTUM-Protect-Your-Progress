import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Eye, EyeOff, Github, Loader, User, Lock, Check } from 'lucide-react'
import { Button } from '../components/ui'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthProvider'
import { validateRegistration } from '../auth/validation'
import { getGithubLoginUrl } from '../api/auth'

function PasswordStrengthIndicator({ password }) {
  let strength = 0
  let color = 'text-muted'
  let label = ''

  if (password.length >= 8) strength++
  if (/[A-Z]/.test(password)) strength++
  if (/[a-z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++

  if (strength === 0) {
    color = 'text-muted'
    label = 'Password strength: None'
  } else if (strength <= 2) {
    color = 'text-coral'
    label = 'Password strength: Weak'
  } else if (strength === 3) {
    color = 'text-accent'
    label = 'Password strength: Good'
  } else {
    color = 'text-teal-500'
    label = 'Password strength: Strong'
  }

  return (
    <div className="space-y-1">
      <div className="flex h-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${i < strength ? color.replace('text-', 'bg-') : 'bg-line'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${color}`}>{label}</p>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setSession } = useAuth()

  const [formData, setFormData] = useState({ email: '', username: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (serverError) setServerError('')
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setErrors({})
    setServerError('')

    const validation = validateRegistration(formData.email, formData.username, formData.password, formData.confirmPassword)
    if (validation) {
      setErrors({ [validation.field]: validation.message })
      return
    }

    setLoading(true)
    try {
      const { registerUser } = await import('../api/auth')
      const response = await registerUser(formData.email, formData.username, formData.password, formData.confirmPassword)

      setSession(response)
      navigate('/overview')
    } catch (err) {
      const message = err.message || 'Registration failed. Please try again.'
      if (message.includes('email')) {
        setErrors({ email: message })
      } else if (message.includes('username')) {
        setErrors({ username: message })
      } else {
        setServerError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <Logo size={48} />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Create your account</h1>
            <p className="text-sm text-muted">Join Momentum and start protecting your progress</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
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
            <label htmlFor="username" className="block text-sm font-medium text-ink">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 size-5 text-muted" />
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                className={`w-full rounded-lg border border-line bg-canvas pl-10 pr-3 py-2.5 text-sm placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                  errors.username ? 'border-coral' : ''
                }`}
              />
            </div>
            {errors.username && <p className="text-xs text-coral">{errors.username}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-5 text-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`w-full rounded-lg border border-line bg-canvas pl-10 pr-10 py-2.5 text-sm placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                  errors.password ? 'border-coral' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.password && <PasswordStrengthIndicator password={formData.password} />}
            {errors.password && <p className="text-xs text-coral">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
              Confirm Password
            </label>
            <div className="relative">
              <Check className="absolute left-3 top-3 size-5 text-muted" />
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className={`w-full rounded-lg border border-line bg-canvas pl-10 pr-10 py-2.5 text-sm placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                  errors.confirmPassword ? 'border-coral' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-3 text-muted hover:text-ink"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-coral">{errors.confirmPassword}</p>}
          </div>

          {serverError && (
            <div className="rounded-lg border border-coral/20 bg-coral/5 p-3 text-sm text-coral">{serverError}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader className="mr-2 animate-spin" size={16} />}
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-canvas px-2 text-muted">Or register with</span>
          </div>
        </div>

        <a href={getGithubLoginUrl()}>
          <Button type="button" variant="secondary" className="w-full">
            <Github size={18} className="mr-2" />
            Continue with GitHub
          </Button>
        </a>

        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} className="font-medium text-accent hover:text-accent/80">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}

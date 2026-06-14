import { useCallback, useState } from 'react'
import { useAuth } from './AuthProvider'
import { loginUser, registerUser, logoutUser } from '../api/auth'

export function useLogin() {
  const { setSession } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(
    async (email, password) => {
      setError(null)
      setLoading(true)
      try {
        const response = await loginUser(email, password)
        setSession(response)
        return response
      } catch (err) {
        const message = err.message || 'Login failed'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [setSession],
  )

  return { login, loading, error }
}

export function useRegister() {
  const { setSession } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const register = useCallback(
    async (email, username, password, confirmPassword) => {
      setError(null)
      setLoading(true)
      try {
        const response = await registerUser(email, username, password, confirmPassword)
        setSession(response)
        return response
      } catch (err) {
        const message = err.message || 'Registration failed'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [setSession],
  )

  return { register, loading, error }
}

export function useLogout() {
  const { signOut } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const logout = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      await logoutUser()
    } catch (err) {
      console.error('Logout API error (continuing anyway):', err)
    } finally {
      signOut()
      setLoading(false)
    }
  }, [signOut])

  return { logout, loading, error }
}

import { useCallback, useState } from 'react'
import { useAuth } from './AuthProvider'
import { logoutUser } from '../api/auth'

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

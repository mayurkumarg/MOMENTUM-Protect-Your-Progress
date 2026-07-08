import { useState, useRef, useEffect } from 'react'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useLogout } from '../../auth/hooks'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../ConfirmDialog'

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const menuRef = useRef(null)
  const { user } = useAuth()
  const { logout } = useLogout()
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleLogout = async () => {
    setLoading(true)
    await logout()
    setLoading(false)
    setOpen(false)
    setShowSignOutConfirm(false)
    navigate('/login')
  }

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?'
  const displayName = user?.username || 'User'
  const email = user?.email || ''

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="focus-ring flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-surface-subtle hover:text-ink transition-colors"
        title="Profile menu"
      >
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-ink">{displayName}</p>
          <p className="truncate text-[11px] text-muted">{email}</p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-line bg-canvas shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Account</p>
          </div>
          
          <button
            onClick={() => {
              navigate('/settings')
              setOpen(false)
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-subtle hover:text-ink transition-colors"
          >
            <User size={16} />
            Profile Settings
          </button>

          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-sm font-medium text-coral hover:bg-coral/5 transition-colors disabled:opacity-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to log in again to access your workspace."
        confirmLabel="Sign out"
        tone="danger"
        isLoading={loading}
        onConfirm={handleLogout}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  )
}

import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)
let idCounter = 0

const TONES = {
  success: { icon: CheckCircle2, border: 'border-l-accent', icon_color: 'text-accent' },
  error: { icon: XCircle, border: 'border-l-coral', icon_color: 'text-coral' },
  info: { icon: Info, border: 'border-l-line-strong', icon_color: 'text-muted' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback((message, { type = 'success', duration = 4000 } = {}) => {
    const id = ++idCounter
    setToasts((current) => [...current, { id, message, type }])
    const timer = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, timer)
    return id
  }, [dismiss])

  const value = useMemo(() => ({
    showToast,
    success: (message) => showToast(message, { type: 'success' }),
    error: (message) => showToast(message, { type: 'error' }),
    info: (message) => showToast(message, { type: 'info' }),
    dismiss,
  }), [showToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((toast) => {
          const tone = TONES[toast.type] || TONES.success
          const Icon = tone.icon
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line ${tone.border} border-l-4 bg-surface p-3.5 shadow-lg`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${tone.icon_color}`} />
              <p className="flex-1 text-sm font-medium leading-5 text-copy">{toast.message}</p>
              <button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="focus-ring shrink-0 rounded text-faint transition-colors hover:text-ink">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

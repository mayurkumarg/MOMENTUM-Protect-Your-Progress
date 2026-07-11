import { useEffect } from 'react'

export default function Modal({ open, onClose, children, labelledBy }) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="w-full max-w-sm rounded-lg border border-line bg-canvas p-5 shadow-xl">
        {children}
      </div>
    </div>
  )
}

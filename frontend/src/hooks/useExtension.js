import { useState, useEffect } from 'react'

export function useExtension() {
  const [status, setStatus] = useState(() => {
    return document.documentElement.getAttribute('data-momentum-extension-status') || 'not_installed'
  })

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window || !event.data) return

      if (event.data.type === 'MOMENTUM_EXTENSION_STATUS') {
        setStatus(event.data.status)
      }
    }

    // Also observe the attribute directly in case the initial load message was missed
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-momentum-extension-status') {
          const newStatus = document.documentElement.getAttribute('data-momentum-extension-status')
          if (newStatus) {
            setStatus(newStatus)
          }
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true })
    window.addEventListener('message', handleMessage)

    return () => {
      observer.disconnect()
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  return {
    isInstalled: status === 'installed' || status === 'connected',
    isConnected: status === 'connected',
    status, // 'not_installed' | 'installed' | 'connected'
  }
}
